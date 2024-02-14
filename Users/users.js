const {
  putItem,
  updateItem,
  deleteItem,
  queryItem,
  queryItemPaginated,
  batchGetItem
} = require("../Utils/DBClient");

const {
  createResponse,
  updateResponse,
  okResponse,
  deleteResponse,
  internalServerError,
  badRequestResponse
} = require("../Utils/responseCodes").responseMessages;

const { customValidator } = require("../Utils/customValidator");

const { cognitoIdentityService } = require("../Utils/cognitoConnection.js");

const { USER_POOL_ID } = process.env;

function deleteCognitoUser(userId) {
  return cognitoIdentityService
    .adminDeleteUser({
      UserPoolId: USER_POOL_ID,
      Username: userId
    })
    .promise()
    .then(result => {
      console.log("result", result);
      return okResponse("user deleted successfully from the cognito", result);
    })
    .catch(err => {
      console.log("error", err);
      return badRequestResponse("unable to delete cognito user", err);
    });
}

function createUser(event) {
  console.log("Inside createUser function", event);

  const errors = customValidator(event, ["userId", "email"]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { userId, name, email } = event;

  const params = {
    TableName: "UsersTable",
    Item: {
      userId,
      name,
      email,
      profilePicture: "",
      projectIds: [],
      createdAt: new Date(Date.now()).toISOString()
    }
  };

  return putItem(params)
    .then(() =>
      okResponse(`user created successfully with the email id : ${email}`)
    )
    .catch(err => internalServerError(err));
}

function getUser(event) {
  console.log("Inside getUser function", event);

  const errors = customValidator(event, ["email"]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { email } = event;

  const params = {
    TableName: "UsersTable",
    IndexName: "byEmailId",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": email
    }
  };

  return queryItem(params)
    .then(result => okResponse("fetched user", result))
    .catch(err => internalServerError(err));
}

function getUserByUserId(event) {
  console.log("Inside getUserByUserId Function", event);

  const errors = customValidator(event, ["userId"]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { userId } = event;

  const params = {
    TableName: "UsersTable",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId
    }
  };

  return queryItem(params)
    .then(result => okResponse("fetched result", result))
    .catch(err => internalServerError(err));
}

async function updateUser(event) {
  console.log("Inside updateUser Function", event);

  const errors = customValidator(event, ["userId"]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { userId } = event;

  delete event.userId;

  let updateExpression = "set";
  let ExpressionAttributeNames = {};
  let ExpressionAttributeValues = {};
  for (const property in event) {
    updateExpression += ` #${property} = :${property} ,`;
    ExpressionAttributeNames["#" + property] = property;
    ExpressionAttributeValues[":" + property] = event[property];
  }

  // removing last comma
  updateExpression = updateExpression.slice(0, -1);

  const params = {
    TableName: "UsersTable",
    Key: {
      userId
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues
  };

  return updateItem(params)
    .then(async () => {
      return updateResponse(`user updated successfully with userId ${userId}`);
    })
    .catch(err => internalServerError(err, `Error to update the user`));
}

function deleteUser(event) {}

module.exports = {
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUserByUserId
};
