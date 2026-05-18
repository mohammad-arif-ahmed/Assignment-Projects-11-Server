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

        const result =
          await contestsCollection.insertOne(contest);

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // get all contests with pagination
  router.get("/", async (req, res) => {

    try {

      const page = parseInt(req.query.page) || 1;

      const limit = 10;

      const skip = (page - 1) * limit;

      const query = {
        status: "approved",
      };

      const contests =
        await contestsCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray();

      const total =
        await contestsCollection.countDocuments(query);

      res.send({
        contests,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      });

    } catch (error) {

      res.status(500).send({
        message: error.message,
      });

    }

  });

  // popular contests
  router.get(
    "/popular",
    async (req, res) => {

      try {

        const result =
          await contestsCollection
            .find({
              status: "approved",
            })
            .sort({
              participantsCount: -1,
            })
            .limit(5)
            .toArray();

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // search contests by type
  router.get(
    "/search/type",
    async (req, res) => {

      try {

        const type = req.query.type;

        const query = {
          contestType: {
            $regex: type,
            $options: "i",
          },
          status: "approved",
        };

        const result =
          await contestsCollection
            .find(query)
            .toArray();

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );
  // get all approved contests
  router.get(
    "/approved/all",
    async (req, res) => {

      try {

        const result =
          await contestsCollection
            .find({ status: "approved" })
            .toArray();

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );
  // creator contests
  router.get(
    "/creator/:email",
    verifyJWT,
    verifyCreator,
    async (req, res) => {

      try {

        const email = req.params.email;

        const query = {
          creatorEmail: email,
        };

        const result =
          await contestsCollection
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

  // contest details
  router.get(
    "/:id",
    async (req, res) => {

      try {

        const id = req.params.id;

        const query = {
          _id: new ObjectId(id),
        };

        const result =
          await contestsCollection.findOne(query);

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // update contest
  router.patch(
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

        const result =
          await contestsCollection.updateOne(
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

        const result =
          await contestsCollection.deleteOne(query);

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