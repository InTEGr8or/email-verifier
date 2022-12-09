'use strict';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import processResponse from './process-response.js';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const SES = new AWS.SES();
const TABLE_NAME = process.env.TABLE_NAME;
const FROM_EMAIL = process.env.FROM_EMAIL;
const IS_CORS = true;
const UTF8CHARSET = 'UTF-8';

function isValidEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

const eventToRequestData = event => {
  var requestData = {};
  //Validate and parse event
  if (event && event.requestContext.http.method === 'OPTIONS') {
    return processResponse(IS_CORS);
  }
  if (event && event.requestContext.http.method === 'POST') {
    console.log("Processing POST data:", event);
    if (!event) { return processResponse(IS_CORS, `Event object missing from call`) };
    if (!event.body) {
      console.error("MISSING EVENT BODY:", event)
      return processResponse(IS_CORS, `Handler event body not found.`, 400);
    }
    requestData = JSON.parse(event.body);
  }
  if (event && event.requestContext.http.method === 'GET') {
    console.log("Parsing rawQuerystring", event.rawQueryString);
    const segments = event.rawQueryString.split("&");
    console.log("Splitting querystring segments", segments);
    segments.forEach((segment) => {
      requestData[segment.split("=")[0]] = segment.split("=")[1];
    })
  }
  return requestData;
}

const sendVerificationAcknowledgment = async (toEmail, verificationKey) => {
  console.log("Starting verification link process")
  const verificationLink = `?email=${toEmail}&verificationKey=${verificationKey}`
  const emailParams = {
    Destination: {
      ToAddresses: [toEmail]
    },
    Message: {
      Body: {
          Text: {
              Charset: UTF8CHARSET,
              Data: `Please verify your email by clicking on this link: ${verificationLink}`
          },
          Html: {
              Charset: UTF8CHARSET,
              Data: `Please verify your email by clicking this link <a href="${verificationLink}">Verification Link</a>`
          },

      },
      Subject: {
        Charset: UTF8CHARSET,
        Data: "Please verify your email address"
      }
    },
    Source: FROM_EMAIL,
    ReplyToAddresses: [FROM_EMAIL]
  };

  try {
    console.log("Sending verification link to:", emailParams);
    const result = await SES.sendEmail(emailParams).promise();
    console.log("Sent verification link", result);
    return processResponse(true);
  } catch (err) {
    console.error(err, err.stack);
    const errorResponse = `Error: Execution update, caused a SES error, please look at your logs.`;
    return processResponse(true, errorResponse, 500);
  }
}


export const handler = async event => {
  console.log("EVENT:", JSON.stringify(event));
  // If verificationKey and email are in the request:
  // 1. Upsert the db where email and event.verificationKey matches the db record

  var requestData = eventToRequestData(event);

  // Verify and exit, if includes verificationKey
  if (requestData.verificationKey) {
    // Update email-table and set verified to true
    requestData.modifiedDate = new Date().toISOString();
    dynamoDb.update({
      TableName: TABLE_NAME,
      Item: requestData
    });
    window.location = ;
    const redirect = {
      statusCode: 302,
      headers: {
        Location: "https://handex.io/email-verified"
      }
    }
    return redirect;
  }

  // Validate email format
  if (!requestData.email || !isValidEmail(requestData.email)) {
    return processResponse(IS_CORS, "contact missing or malformed email", 400);
  }

  // Construct new email record
  requestData.createdDate = new Date().toISOString();
  requestData.verificationKey = uuidv4();
  const params = {
    TableName: TABLE_NAME,
    Item: requestData
  }
  try {
    await dynamoDb.put(params).promise()

    // Send verification email
    sendVerificationAcknowledgment(requestData.email, requestData.verificationKey);
    return processResponse(IS_CORS, "A Verification link has been sent to the email you provided", 200);
  } catch (error) {
    let errorResponse = `Error: Execution update, caused a Dynamodb error, please look at your logs.`;
    if (error.code === 'ValidationException') {
      if (error.message.includes('reserved keyword')) errorResponse = `Error: You're using AWS reserved keywords as attributes`;
    }
    console.log(error);
    return processResponse(IS_CORS, errorResponse, 500);
  }
};