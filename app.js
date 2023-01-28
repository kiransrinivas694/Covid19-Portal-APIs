const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running");
    });
  } catch (e) {
    console.log("CRASHED");
    console.log(e.message);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertDBObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

//Token Authentication

const tokenAuthentication = (request, response, next) => {
  let jwtToken = null;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Login API

app.post("/login/", (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
    }
  }
});

// GET states API
app.get("/states/", tokenAuthentication, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((each) => {
      return convertDBObjectToResponseObject(each);
    })
  );
});

//GET State API

app.get("/states/:stateId/", tokenAuthentication, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`;
  const stateDetails = await db.get(getStateQuery);
  response.send(convertDBObjectToResponseObject(stateDetails));
});

//ADD District API

app.post("/districts/", tokenAuthentication, async (request, response) => {
  const detailsObj = request.body;
  console.log(detailsObj);
  const { districtName, stateId, cases, cured, active, deaths } = detailsObj;
  const addDistrictQuery = `INSERT INTO
                                district (district_name , state_id , cases , cured , active , deaths)
                                VALUES
                                (
                                    '${districtName}' ,
                                    ${stateId} ,
                                    ${cases} , 
                                    ${cured} ,
                                    ${active} ,
                                    ${deaths}
                                )`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

const convertDistrictDBObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//GET district API

app.get(
  "/districts/:districtId/",
  tokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId}`;
    const districtDetails = await db.get(getDistrictQuery);

    response.send(convertDistrictDBObjectToResponseObject(districtDetails));
  }
);

//DELETE District API

app.delete(
  "/districts/:districtId/",
  tokenAuthentication,
  (request, response) => {
    const { districtId } = request.params;
    const delDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId}`;
    db.run(delDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE District API

app.put("/districts/:districtId/", tokenAuthentication, (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `UPDATE district
                                    SET district_name = '${districtName}' ,
                                    state_id = ${stateId} ,
                                    cases = ${cases} ,
                                    cured = ${cured} ,
                                    active = ${active} ,
                                    deaths = ${deaths}
                                    WHERE district_id = ${districtId}`;

  db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

//GET State Stats API

app.get(
  "/states/:stateId/stats/",
  tokenAuthentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `SELECT SUM(cases) AS totalCases , SUM(cured) AS totalCured , SUM(active) AS totalActive , SUM(deaths) AS totalDeaths FROM district WHERE state_id = ${stateId}`;
    array = await db.get(getStatsQuery);
    response.send(array);
  }
);

//GET State Name API
app.get(
  "/districts/:districtId/details/",
  tokenAuthentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getDetailsQuery = `SELECT state_name AS stateName FROM state NATURAL JOIN district WHERE district.district_id = ${districtId}`;
    const detailsArray = await db.get(getDetailsQuery);
    response.send(detailsArray);
  }
);

module.exports = app;
