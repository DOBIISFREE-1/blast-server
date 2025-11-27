const express = require("express");
const axios = require("axios");
const cors = require("cors");
const xml2js = require("xml2js");

const app = express();
app.use(cors());
app.use(express.json());

const parser = new xml2js.Parser({ explicitArray: false });

app.post("/blast", async (req, res) => {
  try {
    let querySequence = req.body.query;

    console.log(">>> Received querySequence:", querySequence);

    if (!querySequence || querySequence.trim() === "") {
      return res.status(400).json({ error: "query is required" });
    }

    querySequence = querySequence.replace(/\r?\n/g, " ").trim();

    // FASTA 형식 만들기
    const fasta = `>query\n${querySequence}`;
    console.log(">>> FASTA string sent to NCBI:",
