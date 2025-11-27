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

    // ✅ 줄바꿈 제거 및 공백 처리
    querySequence = querySequence.replace(/\r?\n/g, " ").trim();

    const params = new URLSearchParams();
    params.append("CMD", "Put");
    params.append("PROGRAM", "blastn");
    params.append("DATABASE", "nt");

    params.append("QUERY", '>query/n${querySequence}');
    params.append("FORMAT_TYPE", "XML");

    const response = await axios.post(
      "https://blast.ncbi.nlm.nih.gov/Blast.cgi",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // ✅ XML 아닌 경우 미리보기 출력
    if (!response.data.includes("<BlastOutput>") && !response.data.includes("<RID>")) {
      console.error("NCBI returned non-XML response:", response.data.substring(0, 300));
      return res.status(500).send("NCBI returned non-XML response, check your query");
    }

    res.send(response.data);
  } catch (err) {
    console.error("BLAST PUT Error:", err.message);
    res.status(500).send("BLAST Put Failed: " + err.message);
  }
});

// RID로 BLAST 상태 확인 / 결과 가져오기
app.get("/blast/:rid", async (req, res) => {
  const rid = req.params.rid;

  if (!rid) return res.status(400).json({ error: "RID is required" });

  try {
    const response = await axios.get(
      `https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=XML`
    );

    if (!response.data.includes("<BlastOutput>")) {
      console.error("NCBI returned non-XML response:", response.data.substring(0, 300));
      return res.status(500).send("NCBI returned non-XML response");
    }

    res.send(response.data);
  } catch (err) {
    console.error("BLAST GET Error:", err.message);
    res.status(500).send("BLAST Get Failed: " + err.message);
  }
});

// Health Check
app.get("/", (req, res) => {
  res.send("BLAST Proxy Server Running ✅");
});

// ✅ Render 포트 바인딩
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

