const {
  createProject,
  getProject,
  updateProject,
  joinProject,
  deleteProject,
  removeMember,
} = require("./projects");

const {
  badRequestResponse,
} = require("../Utils/responseCodes").responseMessages;

exports.main = async (event) => {
  console.log("Input to the Projects lambda", event);

  const { action, details } = event;
  delete event.action;

  if (details) {
    if (details.userId) delete details.userId;

    event = {
      ...event,
      ...details,
    };

    delete event.details;
  }

  if (action === "create") {
    return createProject(event);
  } else if (action === "update") {
    return updateProject(event);
  } else if (action === "get") {
    return getProject(event);
  } else if (action === "joinProject") {
    return joinProject(event);
  } else if (action === "delete") {
    return deleteProject(event);
  } else if (action === "removeMember") {
    return removeMember(event);
  } else {
    return badRequestResponse(action);
  }
};
