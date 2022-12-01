import aws from "aws-sdk";

const db = new aws.DynamoDB("EmailTable");

export const helloFromLambdaHandler = async (event) => {
    console.log("EVENT:", event);

    db.put(`${event.email}`)
    // If you change this message, you will need to change hello-from-lambda.test.mjs
    const message = 'Hello from Lambda!';

    // All log statements are written to CloudWatch
    console.info(`${message}`);
    
    return message;
}
