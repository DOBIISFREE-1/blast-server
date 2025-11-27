// server.js
const express = require('express');
const app = express();
const port = 3000; // Flutter 앱이 접근할 포트 번호

// JSON 데이터를 처리하기 위한 미들웨어
app.use(express.json());

// 1. 간단한 GET 요청 처리 엔드포인트
app.get('/', (req, res) => {
    res.send('Hello from Node.js Server!');
});

// 2. Flutter 앱으로부터 데이터를 받아 처리하는 POST 요청 엔드포인트
app.post('/api/data', (req, res) => {
    const dataFromFlutter = req.body;
    console.log('Received data from Flutter:', dataFromFlutter);

    // Flutter 앱으로 응답 전송
    res.json({
        status: 'success',
        message: 'Data processed successfully by Node.js!',
        received: dataFromFlutter
    });
});

app.listen(port, () => {
    console.log(`Node.js server listening at http://localhost:${port}`);
});