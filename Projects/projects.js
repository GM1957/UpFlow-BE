const {
  putItem,
  updateItem,
  deleteItem,
  queryItem,
  queryItemPaginated,
  batchGetItem,
} = require("../Utils/DBClient");

const {
  createResponse,
  updateResponse,
  okResponse,
  deleteResponse,
  internalServerError,
  badRequestResponse,
} = require("../Utils/responseCodes").responseMessages;

const { getUserByUserId, updateUser } = require("../Users/users");

const uuid = require("uuid");

const { customValidator } = require("../Utils/customValidator");

async function createProject(event) {
  console.log("Inside createProject function", event);

  const errors = customValidator(event, ["userId", "projectName"]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { userId, projectDescription, projectName, projectPicture } = event;

  if (projectName.length < 1)
    return badRequestResponse("project name length should be > 1");

  const promises = [];

  const joinId = uuid
    .v4()
    .split("-")
    .join("")
    .substring(0, 8);

  const user = await getUserByUserId({ userId });
  const oldProjectIds = user.data[0].projectIds;
  delete user.data[0].projectIds;

  const projectId = uuid.v4();
  const params = {
    TableName: "ProjectsTable",
    Item: {
      projectId,
      adminIds: [user.data[0]],
      teamMemberIds: [user.data[0]],
      joinId,
      projectName,
      projectDescription: projectDescription ? projectDescription : "",
      projectPicture: projectPicture ? projectPicture : "",
      kanbanDetails: {},
    },
  };

  const projectObj = {
    projectId,
    projectPicture: projectPicture ? projectPicture : "",
    projectName,
  };
  const newProjectIds = [...oldProjectIds, projectObj];

  promises.push(updateUser({ userId, projectIds: newProjectIds }));
  promises.push(putItem(params));
  return Promise.all(promises)
    .then(() => okResponse("project created successfuly", projectObj))
    .catch((err) => internalServerError(err));
}

function adminUpdateProject(event) {
  console.log("Inside adminUpdateProject function", event);

  const { projectId } = event;

  delete event.projectId;

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
    TableName: "ProjectsTable",
    Key: {
      projectId,
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: ExpressionAttributeNames,
    ExpressionAttributeValues: ExpressionAttributeValues,
  };

  return updateItem(params)
    .then(() =>
      updateResponse(
        `project updated successfully of the project-id:  ${projectId}`
      )
    )
    .catch((err) =>
      internalServerError(
        err,
        `unable to update the project with project-id : ${projectId}`
      )
    );
}

function updateProject(event) {
  console.log("Inside updateProject function", event);

  const errors = customValidator(event, ["userId", "projectId"]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { userId, projectId } = event;

  return getProject(event)
    .then((projectDetails) => {
      if (!Object.keys(projectDetails.data).length)
        return badRequestResponse(
          "sorry you are nither an admin nor a team member"
        );

      delete event.userId;
      delete event.projectId;
      // if not te member then get project function will throw error
      const adminIdsArr = projectDetails.data.adminIds.map(
        (item) => item.userId
      );
      if (adminIdsArr.includes(userId))
        return adminUpdateProject({ ...event, projectId });

      if (event.adminIds) delete event.adminIds;
      if (event.projectDescription) delete event.projectDescription;
      if (event.projectId) delete event.projectId;
      if (event.projectName) delete event.projectName;
      if (event.projectPicture) delete event.projectPicture;
      if (event.joinId) delete event.joinId;
      if (event.teamMemberIds) delete event.teamMemberIds;

      return adminUpdateProject({ ...event, projectId });
    })

    .catch((err) =>
      internalServerError(
        err,
        `unable to update the project with project-id : ${projectId}`
      )
    );
}

function getProject(event) {
  console.log("Inside getProject function", event);

  const errors = customValidator(event, ["userId", "projectId"]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { userId, projectId } = event;

  const params = {
    RequestItems: {
      ProjectsTable: {
        Keys: [{ projectId }],
      },
    },
  };

  return batchGetItem(params)
    .then((result) => {
      const projectDetails = result.Responses.ProjectsTable;
      if (!projectDetails.length) return badRequestResponse("no project found");

      const teamMembers = projectDetails[0].teamMemberIds.map(
        (item) => item.userId
      );

      if (!teamMembers.includes(userId))
        return badRequestResponse(
          "sorry you are not allowed to see this project details because you are not a member of this project"
        );

      return okResponse("fetched details", projectDetails[0]);
    })
    .catch((err) => internalServerError(err));
}

function joinProject(event) {
  console.log("Inside joinProject function", event);

  const errors = customValidator(event, ["joinId", "userId"]);
  if (errors.length) return badRequestResponse("missing mandetory fields");

  const { joinId, userId } = event;

  if (joinId.length < 8)
    return badRequestResponse("joinId length should be = 8");

  return getUserByUserId({ userId }).then((result) => {
    const user = result.data[0];

    const userWithoutProjectIds = { ...user };
    delete userWithoutProjectIds.projectIds;

    const params = {
      TableName: "ProjectsTable",
      IndexName: "byJoinId",
      KeyConditionExpression: "joinId = :joinId",
      ExpressionAttributeValues: {
        ":joinId": joinId,
      },
    };

    return queryItem(params).then((queryResult) => {
      if (!queryResult.length)
        return badRequestResponse(`join id not found : ${joinId}`);
      const { projectId, projectPicture, projectName } = queryResult[0];

      const projectObj = {
        projectId,
        projectPicture,
        projectName,
      };

      const promises = [
        adminUpdateProject({
          projectId,
          teamMemberIds: [
            ...queryResult[0].teamMemberIds,
            { ...userWithoutProjectIds },
          ],
        }),
        updateUser({ userId, projectIds: [projectObj, ...user.projectIds] }),
      ];

      return Promise.all(promises)
        .then(() =>
          okResponse("joined the project successfully", queryResult[0])
        )
        .catch((err) => internalServerError(err));
    });
  });
}

function removeMember(event) {
  console.log("Inside removeMember function", event);

  const errors = customValidator(event, [
    "userId",
    "projectId",
    "newTeamMemberIds",
    "removedUserId",
  ]);

  if (errors.length)
    return badRequestResponse("missing mandetory fields", errors);

  const { userId, projectId, newTeamMemberIds, removedUserId } = event;

  return updateProject({ userId, projectId, teamMemberIds: newTeamMemberIds })
    .then(async (response) => {
      if (response.status) {
        const user = await getUserByUserId({ userId: removedUserId });
        const newUserProjectIds = [];
        user.data[0].projectIds.forEach((item) => {
          if (!item.projectId === projectId) newUserProjectIds.push(item);
        });
        return updateUser({
          userId: removedUserId,
          projectIds: newUserProjectIds,
        }).then(() => okResponse("member deleted from the project successfully"));
      }
      return badRequestResponse("sorry you are not an admin of this project");
    })
    .catch((err) => internalServerError(err));
}

function deleteProject(event) {}

module.exports = {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  joinProject,
  removeMember,
};
