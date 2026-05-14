const express = require("express");

const router = express.Router();

const usersRoutes = (usersCollection) => {

  // save user to database
  router.post("/", async (req, res) => {
    try {

      const user = req.body;

      // check if user already exists
      const query = { email: user.email };

      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({
          message: "User already exists",
          inserted: false,
        });
      }

      // default role
      user.role = "user";

      // save created time
      user.createdAt = new Date();

      // insert user
      const result = await usersCollection.insertOne(user);

      res.send(result);

    } catch (error) {

      res.status(500).send({
        message: error.message,
      });

    }
  });

  return router;
};

module.exports = usersRoutes;