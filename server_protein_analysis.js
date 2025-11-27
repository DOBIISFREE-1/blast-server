const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// 단백질 분석 상수 (g/mol) 및 pKa 값
// ----------------------------------------------------
const AMINO_ACID_WEIGHTS = {
    'A': 71.0788, 'R': 156.1875, 'N': 114.1038, 'D': 115.0886, 'C': 103.1388,
    'E': 129.1155, 'Q': 128.1307, 'G': 57.0519, 'H': 137.1411, 'I': 113.1594,
    'L': 113.1594, 'K': 128.1741, 'M': 131.1926, 'F': 147.1766, 'P': 97.1167,
    'S': 87.0782, 'T': 101.1051, 'W': 186.2132, 'Y': 163.1760, 'V': 99.1326,
    // 물 분자 질량 (peptide bond 형성 시 제거됨)
    'H2O': 18.0153
};

const pKa_VALUES = {
    'NTerm': 9.69, 'CTerm': 2.34,
    'R': 12.48, 'H': 6.00, 'K': 10.53, // 양전하 그룹
    'D': 3.86, 'E': 4.25, 'C': 8.18, 'Y': 10.07 // 음전하 그룹
};

// ----------------------------------------------------
// 2차 구조 예측을 위한 아미노산 경향성 (Propensity) 값 (Chou-Fasman 기준)
// H: Alpha-Helix (알파-나선), E: Beta-Sheet (베타-시트)
// ----------------------------------------------------
const SECONDARY_STRUCTURE_PROPENSITY = {
    'A': { H: 1.42, E: 0.83 }, 'R': { H: 0.98, E: 0.93 }, 'N': { H: 0.67, E: 0.89 },
    'D': { H: 1.01, E: 0.54 }, 'C': { H: 0.70, E: 1.19 }, 'E': { H: 1.51, E: 0.37 },
    'Q': { H: 1.11, E: 1.10 }, 'G': { H: 0.57, E: 0.75 }, 'H': { H: 1.00, E: 0.87 },
    'I': { H: 1.08, E: 1.60 }, 'L': { H: 1.21, E: 1.01 }, 'K': { H: 1.16, E: 0.74 },
    'M': { H: 1.45, E: 1.05 }, 'F': { H: 1.13, E: 1.38 }, 'P': { H: 0.57, E: 0.57 },
    'S': { H: 0.77, E: 0.75 }, 'T': { H: 0.83, E: 1.19 }, 'W': { H: 1.08, E: 1.25 },
    'Y': { H: 0.69, E: 1.29 }, 'V': { H: 1.06, E: 1.70 }
};

// ----------------------------------------------------
// 2차 구조 예측 로직 (Simplified Propensity)
// ----------------------------------------------------
function predictSecondaryStructure(sequence) {
    let helixCount = 0;
    let sheetCount = 0;
    let coilCount = 0;
    const totalLength = sequence.length;

    for (const aa of sequence) {
        const prop = SECONDARY_STRUCTURE_PROPENSITY[aa];
        
        if (!prop) {
            coilCount++;
            continue;
        }

        // 가장 높은 경향성을 가진 구조로 할당 (단순화된 모델)
        // 1.0 이상인 경우만 고려하여 불확실성을 코일로 분류
        if (prop.H > prop.E && prop.H > 1.0) {
            helixCount++;
        } else if (prop.E > prop.H && prop.E > 1.0) {
            sheetCount++;
        } else {
            coilCount++; // 경향성이 낮거나, 둘 다 낮을 경우 코일(무정형)로 분류
        }
    }

    // 결과 비율 계산
    const Helix = (helixCount / totalLength) * 100;
    const Sheet = (sheetCount / totalLength) * 100;
    const Coil = (coilCount / totalLength) * 100;

    // 부동 소수점 오차로 인해 합계가 100이 아닐 수 있으므로, Coil 비율을 조정하여 합계를 100으로 맞춤
    const sum = Helix + Sheet + Coil;
    const correctionFactor = 100 / sum;

    return {
        Helix: Helix * correctionFactor,
        Sheet: Sheet * correctionFactor,
        Coil: Coil * correctionFactor
    };
}


// ----------------------------------------------------
// 아미노산 개수 카운트 및 분자량 계산
// ----------------------------------------------------
function countAminoAcids(sequence) {
    const counts = {};
    const totalLength = sequence.length;
    for (const key in AMINO_ACID_WEIGHTS) {
        if (key.length === 1) { 
            counts[key] = 0;
        }
    }

    for (const aa of sequence) {
        if (counts.hasOwnProperty(aa)) {
            counts[aa]++;
        }
    }
    counts.totalLength = totalLength;
    return counts;
}

function calculateMolecularWeight(sequence, counts) {
    let mw = 0;
    
    // 1. 모든 아미노산 잔기 무게 합산
    for (const aa in counts) {
        if (aa.length === 1) {
            mw += counts[aa] * AMINO_ACID_WEIGHTS[aa];
        }
    }
    
    // 2. 비결합된 H2O (N-말단 H, C-말단 OH) 추가
    mw += AMINO_ACID_WEIGHTS['H2O']; 
    
    return mw;
}

// ----------------------------------------------------
// 등전점 (pI) 계산 로직 (이분법 사용)
// ----------------------------------------------------

function calculateCharge(pH, pKaArr, counts) {
    let charge = 0;
    
    // 1. 양전하 그룹 (N-말단, R, H, K)
    charge += 1 / (1 + Math.pow(10, pH - pKaArr[1])); 
    
    let pKaIndex = 2;
    // R (Arginine)
    for (let i = 0; i < counts['R']; i++) {
        charge += 1 / (1 + Math.pow(10, pH - pKaArr[pKaIndex++]));
    }
    // H (Histidine)
    for (let i = 0; i < counts['H']; i++) {
        charge += 1 / (1 + Math.pow(10, pH - pKaArr[pKaIndex++]));
    }
    // K (Lysine)
    for (let i = 0; i < counts['K']; i++) {
        charge += 1 / (1 + Math.pow(10, pH - pKaArr[pKaIndex++]));
    }

    // 2. 음전하 그룹 (C-말단, D, E, C, Y)
    charge -= 1 / (1 + Math.pow(10, pKaArr[0] - pH)); 
    
    // D (Aspartic Acid)
    for (let i = 0; i < counts['D']; i++) {
         charge -= 1 / (1 + Math.pow(10, pKaArr[pKaIndex++] - pH));
    }
    // E (Glutamic Acid)
    for (let i = 0; i < counts['E']; i++) {
         charge -= 1 / (1 + Math.pow(10, pKaArr[pKaIndex++] - pH));
    }
    // C (Cysteine)
    for (let i = 0; i < counts['C']; i++) {
         charge -= 1 / (1 + Math.pow(10, pKaArr[pKaIndex++] - pH));
    }
    // Y (Tyrosine)
    for (let i = 0; i < counts['Y']; i++) {
         charge -= 1 / (1 + Math.pow(10, pKaArr[pKaIndex++] - pH));
    }
    
    return charge;
}

function calculatePI(sequence) {
    const counts = countAminoAcids(sequence);
    const pKas = [];
    pKas.push(pKa_VALUES.CTerm); 
    pKas.push(pKa_VALUES.NTerm); 
    
    // 전하를 띠는 모든 곁사슬의 pKa 값을 배열에 추가
    ['R', 'H', 'K', 'D', 'E', 'C', 'Y'].forEach(aa => {
        for (let i = 0; i < counts[aa]; i++) {
            pKas.push(pKa_VALUES[aa]);
        }
    });

    if (pKas.length === 0) return 7.0; 
    pKas.sort((a, b) => a - b);
    
    let pH_low = 0.0;
    let pH_high = 14.0;
    let pI = 7.0;

    for (let i = 0; i < 100; i++) { // 이분법 100회 반복
        pI = (pH_low + pH_high) / 2;
        const charge = calculateCharge(pI, pKas, counts);

        if (charge > 0) {
            pH_low = pI;
        } else {
            pH_high = pI;
        }
        
        if (Math.abs(charge) < 0.001) break;
    }

    return pI;
}


// ----------------------------------------------------
// API 엔드포인트
// ----------------------------------------------------
app.post("/analyze-protein", async (req, res) => {
    try {
        let sequence = req.body.sequence;

        if (!sequence || typeof sequence !== 'string') {
            return res.status(400).json({ error: "단백질 서열(sequence)이 문자열 형태로 필요합니다." });
        }
        
        // 유효 아미노산 문자만 추출하고 대문자로 변환
        sequence = sequence.toUpperCase().replace(/[^ARNDCEQGHILKMFPSTWYV]/g, '');

        if (sequence.length < 5) {
            return res.status(400).json({ error: "유효한 단백질 서열이 너무 짧습니다. 최소 5개 이상의 아미노산이 필요합니다." });
        }

        const counts = countAminoAcids(sequence);
        const totalLength = counts.totalLength;
        const mw = calculateMolecularWeight(sequence, counts);
        
        // 긴 서열에 대한 pI 계산 시간 제한 설정
        const pI = totalLength <= 3000 ? calculatePI(sequence) : null; 
        
        // 2차 구조 예측
        const secondaryStructure = predictSecondaryStructure(sequence);

        const composition = {};
        for (const aa in counts) {
            if (aa.length === 1) {
                composition[aa] = {
                    count: counts[aa],
                    percentage: (counts[aa] / totalLength) * 100
                };
            }
        }

        res.json({
            sequenceLength: totalLength,
            molecularWeight: parseFloat(mw.toFixed(2)),
            isoelectricPoint: pI ? parseFloat(pI.toFixed(2)) : '서열이 너무 길어 계산 생략',
            composition: composition,
            secondaryStructure: secondaryStructure 
        });

    } catch (err) {
        console.error("Protein Analysis Error:", err);
        res.status(500).send("Protein Analysis Failed: " + err.message);
    }
});

// Health Check
app.get("/", (req, res) => {
    res.send("Protein Analyzer Server Running (v2) ✅");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));