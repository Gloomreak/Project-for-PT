const passwordInput = document.getElementById('passwordInput');
const resultsDiv = document.getElementById('results');
const searchSpaceEl = document.getElementById('searchSpace');
const crackTimeEl = document.getElementById('crackTime');
const entropyEl = document.getElementById('entropyValue');
const effectiveEntropyEl = document.getElementById('effectiveEntropy');
const attackPowerLabel = document.getElementById('attackPowerLabel');
const growthFactorEl = document.getElementById('growthFactor');
const breachStatusEl = document.getElementById('breachStatus');

let ATTACK_POWER = 1000000000;
let chartInstance = null;

document.querySelectorAll('input[name="attackPower"]').forEach(radio => {
    radio.addEventListener('change', function() {
        ATTACK_POWER = parseInt(this.value);
        const label = this.getAttribute('data-label');
        attackPowerLabel.textContent = `При мощности ${label}`;
        if (passwordInput.value.length > 0) {
            passwordInput.dispatchEvent(new Event('input'));
        }
    });
});

passwordInput.addEventListener('input', function() {
    const password = this.value;
    
    if (password.length === 0) {
        resultsDiv.classList.add('hidden');
        return;
    }
    
    resultsDiv.classList.remove('hidden');
    document.getElementById('analyzedPassword').textContent = password;
    
    let poolSize = 0;
    const hasDigits = /[0-9]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    
    if (hasDigits) poolSize += 10;
    if (hasLower) poolSize += 26;
    if (hasUpper) poolSize += 26;
    if (hasSpecial) poolSize += 32;
    if (poolSize === 0) poolSize = 33;
    
    const length = password.length;
    const searchSpace = BigInt(poolSize) ** BigInt(length);
    
    let expectedTime;
    if (searchSpace > BigInt(Number.MAX_SAFE_INTEGER)) {
        const logSpace = length * Math.log10(poolSize);
        const logTime = logSpace - Math.log10(2 * ATTACK_POWER);
        expectedTime = Math.pow(10, logTime);
    } else {
        expectedTime = Number(searchSpace) / (2 * ATTACK_POWER);
    }
    
    const entropy = length * Math.log2(poolSize);
    const patternLoss = calculatePatternLoss(password);
    const effectiveEntropy = Math.max(0, entropy - patternLoss);
    
    searchSpaceEl.textContent = formatLargeNumber(searchSpace);
    crackTimeEl.textContent = formatTime(expectedTime);
    entropyEl.textContent = entropy.toFixed(1) + ' бит';
    effectiveEntropyEl.textContent = effectiveEntropy.toFixed(1) + ' бит';

    checkBreach(password);
    
    entropyEl.style.color = getEntropyColor(entropy);
    effectiveEntropyEl.style.color = getEntropyColor(effectiveEntropy);
    growthFactorEl.textContent = poolSize;
		
    updateExplanations(password, poolSize, length, searchSpace, expectedTime, entropy, effectiveEntropy, patternLoss);
    renderChart(length, poolSize);
    generateRecommendations(password, poolSize, length, entropy, effectiveEntropy, patternLoss);
});

function calculatePatternLoss(password) {
    let lossBits = 0;
    const lowerPassword = password.toLowerCase();
    
    const commonWords = ['password', 'admin', 'user', 'login', 'welcome', 'dragon', 'master', 'monkey', 'shadow', 'sunshine'];
    for (const word of commonWords) {
        if (lowerPassword.includes(word)) lossBits += 30;
    }
    
    const sequences = ['123', '321', 'abc', 'cba', 'qwerty', 'asdf'];
    for (const seq of sequences) {
        if (lowerPassword.includes(seq)) lossBits += 15;
    }
    
    if (/19\d{2}|20\d{2}/.test(password)) lossBits += 10;
    if (/(.)\1{2,}/.test(password)) lossBits += 12;
    
    return lossBits;
}

function updateExplanations(password, poolSize, length, searchSpace, expectedTime, entropy, effectiveEntropy, patternLoss) {
    const hasDigits = /[0-9]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    
    // Пространство перебора
    document.getElementById('expLength').textContent = length;
    document.getElementById('expAlphabet').textContent = poolSize;
    document.getElementById('expR').textContent = poolSize;
    document.getElementById('expL').textContent = length;
    document.getElementById('expN').textContent = formatLargeNumber(searchSpace);
    document.getElementById('expNText').textContent = formatLargeNumber(searchSpace);
    
    document.getElementById('catDigits').classList.toggle('hidden', !hasDigits);
    document.getElementById('catLower').classList.toggle('hidden', !hasLower);
    document.getElementById('catUpper').classList.toggle('hidden', !hasUpper);
    document.getElementById('catSpecial').classList.toggle('hidden', !hasSpecial);
    
    // Время взлома
    const attackLabel = document.querySelector('input[name="attackPower"]:checked').getAttribute('data-label');
    document.getElementById('expTimeN').textContent = formatLargeNumber(searchSpace);
    document.getElementById('expH').textContent = '10^' + Math.log10(ATTACK_POWER);
    document.getElementById('expAttackType').textContent = attackLabel;
    document.getElementById('expTimeN2').textContent = formatLargeNumber(searchSpace);
    document.getElementById('expH2').textContent = '10^' + Math.log10(ATTACK_POWER);
    document.getElementById('expTimeResult').textContent = formatTime(expectedTime);
    
    // Энтропия
    const logR = Math.log2(poolSize);
    document.getElementById('expEntL').textContent = length;
    document.getElementById('expEntR').textContent = poolSize;
    document.getElementById('expEntR2').textContent = poolSize;
    document.getElementById('expLogR').textContent = logR.toFixed(3);
    document.getElementById('expEntL2').textContent = length;
    document.getElementById('expLogR2').textContent = logR.toFixed(3);
    document.getElementById('expEntropy').textContent = entropy.toFixed(2);
    document.getElementById('expEntropyInterp').textContent = getEntropyInterpretation(entropy);
    
    // Эффективная энтропия
    document.getElementById('expTheorEnt').textContent = entropy.toFixed(2);
    document.getElementById('expLoss').textContent = patternLoss.toFixed(1);
    document.getElementById('expHTheor').textContent = entropy.toFixed(2);
    document.getElementById('expHLoss').textContent = patternLoss.toFixed(1);
    document.getElementById('expHEff').textContent = effectiveEntropy.toFixed(2);
    
    const patternsList = document.getElementById('expPatterns');
    patternsList.innerHTML = '';
    const patterns = findPatterns(password);
    
    if (patterns.length === 0) {
        const li = document.createElement('li');
        li.id = 'noPatterns';
        li.textContent = '✅ Паттерны не обнаружены';
        li.style.color = '#388e3c';
        patternsList.appendChild(li);
        document.getElementById('expWarning').classList.add('hidden');
    } else {
        patterns.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `• ${p.name}: −${p.loss} бит`;
            if (p.loss > 20) {
                li.style.color = '#d32f2f';
                li.style.fontWeight = 'bold';
            }
            patternsList.appendChild(li);
        });
        
        const lossPercent = ((patternLoss / entropy) * 100).toFixed(1);
        document.getElementById('expLossPercent').textContent = lossPercent;
        document.getElementById('expWarning').classList.remove('hidden');
    }
}

function findPatterns(password) {
    const patterns = [];
    const lowerPassword = password.toLowerCase();
    
    const commonWords = ['password', 'admin', 'user', 'login', 'welcome', 'dragon', 'master'];
    for (const word of commonWords) {
        if (lowerPassword.includes(word)) patterns.push({name: `Слово "${word}"`, loss: 30});
    }
    
    const sequences = ['123', '321', 'abc', 'qwerty'];
    for (const seq of sequences) {
        if (lowerPassword.includes(seq)) patterns.push({name: `Последовательность "${seq}"`, loss: 15});
    }
    
    if (/19\d{2}|20\d{2}/.test(password)) patterns.push({name: 'Год', loss: 10});
    if (/(.)\1{2,}/.test(password)) patterns.push({name: 'Повторения', loss: 12});
    
    return patterns;
}

function getEntropyInterpretation(entropy) {
    if (entropy < 40) return '🔴 Очень слабая: взлом мгновенно';
    if (entropy < 60) return '🟠 Слабая: минуты/часы';
    if (entropy < 80) return '🟡 Средняя: приемлемо';
    if (entropy < 100) return '🟢 Сильная: хорошая защита';
    return '🟣 Очень сильная: практически невозможно';
}

function getEntropyColor(entropy) {
    if (entropy < 40) return '#c62828';  // Тёмно-красный (было #ef5350)
    if (entropy < 60) return '#ef6c00';  // Тёмно-оранжевый (было #ffa726)
    if (entropy < 80) return '#f9a825';  // Тёмно-жёлтый (было #ffee58)
    return '#2e7d32';                     // Тёмно-зелёный (было #66bb6a)
}

function formatLargeNumber(bigNum) {
    const str = bigNum.toString();
    if (str.length > 15) return str.substring(0, 3) + '×10^' + (str.length - 1);
    return str.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatTime(seconds) {
    if (!isFinite(seconds) || seconds > 31536000000000) return "Более 1 млн лет";
    if (seconds < 1) return "Мгновенно";
    if (seconds < 60) return Math.round(seconds) + " сек";
    if (seconds < 3600) return Math.round(seconds / 60) + " мин";
    if (seconds < 86400) return Math.round(seconds / 3600) + " ч";
    if (seconds < 31536000) return Math.round(seconds / 86400) + " дней";
    return Math.round(seconds / 31536000) + " лет";
}

function renderChart(currentLength, poolSize) {
    const ctx = document.getElementById('strengthChart');
    if (!ctx) return;
    
    const context = ctx.getContext('2d');
    const maxLen = Math.min(currentLength + 2, 20);
    const labels = [];
    const data = [];
    
    for (let i = 0; i <= maxLen; i++) {
        labels.push(i);
        data.push((i * Math.log10(poolSize)).toFixed(1));
    }
    
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(context, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'log₁₀(N)',
                 data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Порядок числа (10^x)' }
                },
                x: {
		    beginAtZero: true,
                    title: { display: true, text: 'Длина пароля' }
                }
            }
        }
    });
}

function generateRecommendations(password, poolSize, length, entropy, effectiveEntropy, patternLoss) {
    const list = document.getElementById('recommendations');
    list.innerHTML = '';
    
    const add = (text) => {
        const li = document.createElement('li');
        li.textContent = text;
        list.appendChild(li);
    };
    
    if (patternLoss > 20) add(`⚠️ Найдены паттерны! Потеряно ~${patternLoss.toFixed(0)} бит`);
    if (length < 12) add(`📈 Увеличьте длину — стойкость вырастет в ${poolSize} раз`);
    if (!/[0-9]/.test(password)) add('➕ Добавьте цифры');
    if (!/[A-Z]/.test(password)) add('➕ Добавьте заглавные буквы');
    if (!/[^a-zA-Z0-9]/.test(password)) add('➕ Добавьте спецсимволы');
    if (effectiveEntropy >= 80) add('🟢 Отличная энтропия!');
}

async function checkBreach(password) {
    try {
        breachStatusEl.textContent = 'Проверка...';
        breachStatusEl.style.color = '#f57c00';
        
        const commonPasswords = [
            '123456', 'password', '12345678', 'qwerty', '123456789',
            '12345', '1234', '111111', '1234567', 'dragon',
            '123123', 'baseball', 'iloveyou', 'trustno1', 'sunshine',
            'master', 'welcome', 'shadow', 'ashley', 'football',
            'jesus', 'michael', 'ninja', 'mustang', 'password1',
            '1234567890', '2024', '2023', 'admin', 'root'
        ];
        
        if (commonPasswords.includes(password.toLowerCase())) {
            breachStatusEl.textContent = '⚠️ Найден в базе популярных паролей';
            breachStatusEl.style.color = '#c62828';
            return;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const hash = await CryptoJS.SHA1(password).toString().toUpperCase();
        const prefix = hash.substring(0, 5);
        const suffix = hash.substring(5);
        
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error('API error');
        
        const data = await response.text();
        const lines = data.split('\n');
        const found = lines.find(line => line.startsWith(suffix));
        
        if (found) {
            const count = found.split(':')[1].trim();
            breachStatusEl.textContent = `⚠️ Найден в базах (${parseInt(count).toLocaleString()} раз)`;
            breachStatusEl.style.color = '#c62828';
        } else {
            breachStatusEl.textContent = '✅ Не найден в известных утечках';
            breachStatusEl.style.color = '#2e7d32';
        }
        
    } catch (error) {
        if (password.length >= 12 && /[A-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password)) {
            breachStatusEl.textContent = '✅ (Оффлайн) Пароль достаточно сложен';
            breachStatusEl.style.color = '#2e7d32';
        } else {
            breachStatusEl.textContent = 'ℹ️ Проверка недоступна';
            breachStatusEl.style.color = '#757575';
        }
    }
}

