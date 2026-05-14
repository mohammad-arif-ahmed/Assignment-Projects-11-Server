const express = require("express");
const { ObjectId } = require("mongodb");

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

  // search contests
  router.get("/search/type", async (req, res) => {

    try {

      const type = req.query.type;

      const query = {
        contestType: {
          $regex: type,
          $options: "i",
        },

        status: "approved",
      };

      const result = await contestsCollection
        .find(query)
        .toArray();

      res.send(result);

    } catch (error) {

      res.status(500).send({
        message: error.message,
      });

    }

  });

  // popular contests
  router.get("/popular/contests", async (req, res) => {

    try {

      const query = {
        status: "approved",
      };

      const result = await contestsCollection
        .find(query)
        .sort({ participantsCount: -1 })
        .limit(5)
        .toArray();

      res.send(result);

    } catch (error) {

      res.status(500).send({
        message: error.message,
      });

    }

  });

  // my created contests
  router.get(
    "/creator/my-contests",
    verifyJWT,
    verifyCreator,
    async (req, res) => {

      try {

        const email = req.query.email;

        const query = {
          creatorEmail: email,
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

    }
  );

  // get single contest
  router.get("/:id", async (req, res) => {

    try {

      const id = req.params.id;

      const query = {
        _id: new ObjectId(id),
      };

      const result = await contestsCollection.findOne(query);

      res.send(result);

    } catch (error) {

      res.status(500).send({
        message: error.message,
      });

    }

  });

  // delete contest
  router.delete(
    "/:id",
    verifyJWT,
    verifyCreator,
    async (req, res) => {

      try {

        const id = req.params.id;

        const query = {
          _id: new ObjectId(id),
        };

        const result = await contestsCollection.deleteOne(query);

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // update contest
  router.put(
    "/:id",
    verifyJWT,
    verifyCreator,
    async (req, res) => {

      try {

        const id = req.params.id;

        const updatedContest = req.body;

        const query = {
          _id: new ObjectId(id),
        };

        const updateDoc = {
          $set: updatedContest,
        };

        const result = await contestsCollection.updateOne(
          query,
          updateDoc
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

module.exports = contestsRoutes;