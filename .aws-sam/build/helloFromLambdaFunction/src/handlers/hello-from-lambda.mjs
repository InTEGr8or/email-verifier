/**
 * A Lambda function that returns a static string
 */
export const helloFromLambdaHandler = async (event) => {
    console.log("EVENT:", event);
    // If you change this message, you will need to change hello-from-lambda.test.mjs
    const message = 'Hello from Lambda!';

    // All log statements are written to CloudWatch
    console.info(`${message}`);
    
    return message;
}
