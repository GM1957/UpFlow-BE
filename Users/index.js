const { createUser, updateUser, deleteUser, getUser } = require("./users");

const {
  badRequestResponse
} = require("../Utils/responseCodes").responseMessages;

exports.main = async event => {
  console.log("Input to the Users lambda", event);

  const { action, details } = event;
  delete event.action;

  if (details) {
    if (details.userId) delete details.userId;

    event = {
      ...event,
      ...details
    };

    delete event.details;
  }

  if (action === "create") {
    return createUser(event);
  } else if (action === "update") {
    return updateUser(event);
  } else if (action === "getUser") {
    return getUser(event);
  } else if (action === "delete") {
    return deleteUser(event);
  } else {
    return badRequestResponse(action);
  }
};
