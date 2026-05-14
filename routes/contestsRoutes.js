const express = require("express");

const router = express.Router();

const contestsRoutes = (
  contestsCollection,
  verifyJWT,
  verifyCreator
) => {

  // add contest
  router.post(
    "/",
    verifyJWT,
    verifyCreator,
    async (req, res) => {

      try {

        const contest = req.body;

        // default values
        contest.status = "pending";

        contest.participantsCount = 0;

        contest.createdAt = new Date();

        const result = await contestsCollection.insertOne(contest);

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // get all approved contests
  router.get("/", async (req, res) => {

    try {

      const query = {
        status: "approved",
      };

      const result = await contestsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);

    } catch (error) {

      res.status(500).send({
        message: error.message,
      });

    }

  });

  return router;
};

module.exports = contestsRoutes;