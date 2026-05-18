const express = require("express");
const { ObjectId } = require("mongodb");

const router = express.Router();

const submissionsRoutes = (
  submissionsCollection,
  contestsCollection,
  usersCollection,
  verifyJWT,
  verifyCreator
) => {

  // submit contest task
  router.post(
    "/",
    verifyJWT,
    async (req, res) => {

      try {

        const submission = req.body;

        submission.submittedAt = new Date();

        const result =
          await submissionsCollection.insertOne(submission);

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // get submissions for creator contests
  router.get(
    "/creator",
    verifyJWT,
    verifyCreator,
    async (req, res) => {

      try {

        const creatorEmail = req.query.email;

        const query = {
          creatorEmail,
        };

        const result = await submissionsCollection
          .find(query)
          .sort({ submittedAt: -1 })
          .toArray();

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // declare winner
  router.patch(
    "/winner/:id",
    verifyJWT,
    verifyCreator,
    async (req, res) => {

      try {

        const submissionId = req.params.id;

        const submissionQuery = {
          _id: new ObjectId(submissionId),
        };

        const submission =
          await submissionsCollection.findOne(
            submissionQuery
          );

        // update contest winner info
        const contestQuery = {
          _id: new ObjectId(submission.contestId),
        };

        const updateDoc = {
          $set: {
            winnerName: submission.participantName,
            winnerEmail: submission.participantEmail,
            winnerTask: submission.submissionText,
          },
        };

        const result = await contestsCollection.updateOne(
          contestQuery,
          updateDoc
        );
        // increase winner count
        await usersCollection.updateOne(

          {
            email: submission.participantEmail,
          },

          {
            $inc: {
              wins: 1,
            },
          }
        );

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  return router;
};

module.exports = submissionsRoutes;