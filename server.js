const express = require("express");
const axios = require("axios");
const cors = require("cors");
const xml2js = require("xml2js");

const app = express();
app.use(cors());
app.use(express.json());
const parser = new xml2js.Parser({ explicitArray: false });

/*
=================================
 1) BLAST 요청 보내기
=================================
*/
app.post("/blast", async (req, res) => {
  try {
    const querySequence = req.body.query;

    if (!querySequence) {
      return res.status(400).json({ error: "query is required" });
    }

    const params = new URLSearchParams();
    params.append("CMD", "Put");
    params.append("PROGRAM", "blastn");
    params.append("DATABASE", "nt");
    params.append("QUERY", querySequence);

    const response = await axios.post(
      "https://blast.ncbi.nlm.nih.gov/Blast.cgi",
      params
    );

    res.send(response.data);
  } catch (err) {
    console.error("BLAST PUT Error:", err);
    res.status(500).send("BLAST Put Failed");
  }
});

/*
=================================
 2) RID로 BLAST 진행 상태 확인/결과 가져오기
=================================
*/
app.get("/blast/:rid", async (req, res) => {
  const rid = req.params.rid;

  try {
    const response = await axios.get(
      `https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=XML`
    );

    res.send(response.data);
  } catch (err) {
    console.error("BLAST GET Error:", err);
    res.status(500).send("BLAST Get Failed");
  }
});

/*
=================================
 Render Health Check
=================================
*/
app.get("/", (req, res) => {
  res.send("BLAST Proxy Server Running on Render");
});

/* ================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
