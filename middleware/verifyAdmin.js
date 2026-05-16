const verifyAdmin = async (req, res, next) => {

  const usersCollection = req.usersCollection;

  const email = req.decoded.email;

  const query = {
    email,
  };

  const user =
    await usersCollection.findOne(query);

  if (!user || user.role !== "admin") {

    return res.status(403).send({
      message: "Forbidden Access",
    });

  }

  next();

};

module.exports = verifyAdmin;