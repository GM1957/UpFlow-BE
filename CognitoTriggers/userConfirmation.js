const { REGION } = process.env;
const AWS = require("aws-sdk");
const { createUser } = require("../Users/users");

const cognitoIdentityService = new AWS.CognitoIdentityServiceProvider({
  apiVersion: "2019-11-07",
  region: REGION
});

const { REDIRECT_URL_AFTER_AUTHENTICATION } = process.env;

function userConfirmation(req, context, callback) {
  console.log("Inside userConfirmation function", req);
  const confirmationCode = req.code;
  const { username, clientId, email } = req;
  const params = {
    ClientId: clientId,
    ConfirmationCode: confirmationCode,
    Username: username
  };
  // Validating the user
  const confirmSignUp = cognitoIdentityService.confirmSignUp(params).promise();
  // Returning to the redirect url
  confirmSignUp
    .then(async () => {
      await createUser({ userId: username, email });
      context.succeed({
        location: REDIRECT_URL_AFTER_AUTHENTICATION
      });
    })
    .catch(error => {
      callback(error.message);
    });
}

module.exports = { userConfirmation };
