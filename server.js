const express = require("express");
const axios = require("axios");
const cors = require("cors");
const xml2js = require("xml2js");

const app = express();
app.use(cors());
app.use(express.json());

const parser = new xml2js.Parser({ explicitArray: false });

// BLAST 요청 (Put)
app.post("/blast", async (req, res) => {
  try {
    let querySequence = req.body.query;

    if (!querySequence || querySequence.trim() === "") {
      return res.status(400).json({ error: "query is required" });
    }

    // 줄바꿈 제거
    querySequence = querySequence.replace(/\r?\n/g, " ");

    const params = new URLSearchParams();
    params.append("CMD", "Put");
    params.append("PROGRAM", "blastn");
    params.append("DATABASE", "nt");
    params.append("QUERY", querySequence);

    const response = await axios.post(
      "https://blast.ncbi.nlm.nih.gov/Blast.cgi",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // NCBI가 XML 아닌 HTML 반환 시 에러
    if (!response.data.includes("<BlastOutput>") && !response.data.includes("<RID>")) {
      console.error("NCBI returned non-XML response:", response.data.substring(0, 300));
      return res.status(500).send("NCBI returned non-XML response, check your query");
    }

    res.send(response.data);
  } catch (err) {
    console.err
