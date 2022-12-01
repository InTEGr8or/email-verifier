import aws from "aws-sdk";

const { TODOS_TABLE, IS_OFFLINE } = process.env;

const dynamoDb = IS_OFFLINE === 'true' ?
  new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000',
  }) :
  new AWS.DynamoDB.DocumentClient();

const post('/emails', (req, res) => {
  const { email, verified = false} = req.body;

  const params = {
    TableName: TODOS_TABLE,
    Item: {
      email,
      verified
    },
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      console.log('Error creating Todo: ', error);
      res.status(400).json({ error: 'Could not create Todo' });
    }

    res.json({ todoId, title, done });
  });
});

export const helloFromLambdaHandler = async (event) => {
    console.log("EVENT:", event);

    db.put(`${event.email}`)
    // If you change this message, you will need to change hello-from-lambda.test.mjs
    const message = 'Hello from Lambda!';

    // All log statements are written to CloudWatch
    console.info(`${message}`);
    
    return message;
}
