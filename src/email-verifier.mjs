import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import processResponse from './process-response.js';

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();
const TABLE_NAME = process.env.TABLE_NAME;
const IS_CORS = true;

function isHTML(value) {
  value = value.trim();
  return value.startsWith('<') && value.endsWith('>') &&
    (value.includes('<body') || value.includes('<div') || value.includes('<s') || value.includes('<h') || value.includes('<p'));
};

function validateEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

export const handler = async event => {
  console.log("EVENT:", JSON.stringify(event));
  var requestData = {
    
  };
  //Validate and parse event
  if (event && event.requestContext.http.method === 'OPTIONS') {
    return processResponse(IS_CORS);
  }
  if (event && event.requestContext.http.method === 'POST') {
    console.log("Processing post data:", event);
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
  // If verificationKey and email are in the request:
  // 1. Upsert the db where email and event.verificationKey matches the db record
  if (requestData.verificationKey) {
    // Update email-table and set verified to true

    await dynamoDb.update({
      TableName: TABLE_NAME,
      Item: requestData
    })
  }
  if (!requestData.email || !validateEmail(requestData.email)) {
    return processResponse(IS_CORS, "contact missing or malformed email", 400);
  }
  requestData.createdDate = new Date().toISOString();
  requestData.verificationKey = uuidv4();
  const params = {
    TableName: TABLE_NAME,
    Item: requestData
  }
  try {
    await dynamoDb.put(params).promise()
    return processResponse(IS_CORS);
  } catch (error) {
    let errorResponse = `Error: Execution update, caused a Dynamodb error, please look at your logs.`;
    if (error.code === 'ValidationException') {
      if (error.message.includes('reserved keyword')) errorResponse = `Error: You're using AWS reserved keywords as attributes`;
    }
    console.log(error);
    return processResponse(IS_CORS, errorResponse, 500);
  }
  //TODO: Send verification email with verificationKey and email in link
  const verificationLink = `?email=`
  const emailParams = {
    Destination: destination,
    Message: {
      Body: body,
      Subject: {
        Charset: UTF8CHARSET,
        Data: emailData.subject
      }
    },
    Source: FROM_EMAIL
  };

  if (emailData.replyToEmails && Array.isArray(emailData.replyToEmails)) {
    emailParams.ReplyToAddresses = emailData.replyToEmails;
  }

  try {
    await SES.sendEmail(emailParams).promise();
    return processResponse(true);
  } catch (err) {
    console.error(err, err.stack);
    const errorResponse = `Error: Execution update, caused a SES error, please look at your logs.`;
    return processResponse(true, errorResponse, 500);
  }
};