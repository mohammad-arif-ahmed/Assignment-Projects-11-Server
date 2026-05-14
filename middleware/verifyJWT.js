const jwt = require("jsonwebtoken");

const verifyJWT = (req, res, next) => {

  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({
      message: "unauthorized access",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {

    if (error) {
      return res.status(401).send({
        message: "unauthorized access",
      });
    }

    req.decoded = decoded;

    next();

  });
};

module.exports = verifyJWT;