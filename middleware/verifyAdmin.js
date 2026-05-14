const verifyAdmin = async (req, res, next) => {

  const email = req.decoded.email;

  const usersCollection = req.usersCollection;

  const query = { email };

  const user = await usersCollection.findOne(query);

  if (!user || user.role !== "admin") {

    return res.status(403).send({
      message: "forbidden access",
    });

  }

  next();
};

module.exports = verifyAdmin;