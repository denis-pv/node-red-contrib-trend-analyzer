module.exports = function(RED) {
    function TrendAnalyzerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        // Настройки из редактора
        node.windowSize = parseInt(config.windowSize) || 10;
        node.multiplier = parseFloat(config.multiplier) || 1.0;
        node.minInterval = parseFloat(config.minInterval) || 0;
        node.name = config.name || "Trend Analyzer";
        
        // Переменные состояния
        node.dataWindow = [];
        node.timestamps = [];
        node.lastAddTime = 0;
        
        // Функция для расчета угла тренда (на основе вашего примера)
function calculateTrendAngle(data, timestamps, multiplier) {
    if (data.length < 3) {
        return { /* ... */ };
    }
    
    const startTime = timestamps[0];
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = data.length;
    
    let minVal = data[0];
    let maxVal = data[0];
    
    for (let i = 0; i < n; i++) {
        const x = (timestamps[i] - startTime) / 60000; // время в МИНУТАХ ✅
        const y = data[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
        
        if (data[i] < minVal) minVal = data[i];
        if (data[i] > maxVal) maxVal = data[i];
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX); // slope в °C/минуту
    const angle = Math.atan(slope * multiplier) * (180 / Math.PI);
    const maxDelta = maxVal - minVal;
    
    return {
        angle: Math.round(angle * 10) / 10,
        amplitude: Math.round(maxDelta * 10) / 10,
        min: Math.round(minVal * 10) / 10,
        max: Math.round(maxVal * 10) / 10,
        data_points: n,
        slope: Math.round(slope * 100) / 100 // °C/минуту
    };
}
        
        // Обработка входящих сообщений
        node.on('input', function(msg, send, done) {
            try {
                const currentTime = Date.now();
                let valueAdded = false;
                
                // Проверка временного интервала
                if (node.minInterval > 0) {
                    const timeDiff = (currentTime - node.lastAddTime) / 1000;
                    if (timeDiff < node.minInterval) {
                        valueAdded = false;
                    } else {
                        valueAdded = true;
                    }
                } else {
                    valueAdded = true;
                }
                
                // Получаем значение
                let value = parseFloat(msg.payload);
                if (isNaN(value)) {
                    node.error("Invalid input: payload must be a number", msg);
                    if (done) done();
                    return;
                }
                
                // Добавляем в окно если прошло достаточно времени
                if (valueAdded) {
                    node.dataWindow.push(value);
                    node.timestamps.push(currentTime);
                    node.lastAddTime = currentTime;
                    
                    // Поддерживаем размер окна
                    if (node.dataWindow.length > node.windowSize) {
                        node.dataWindow.shift();
                        node.timestamps.shift();
                    }
                }
                
                // Рассчитываем статистику
                let trendData;
                if (node.dataWindow.length >= 3) {
                    trendData = calculateTrendAngle(node.dataWindow, node.timestamps, node.multiplier);
                } else {
                    trendData = {
                        angle: 0,                        
                        amplitude: 0,
                        last_value: value,
                        min: node.dataWindow.length > 0 ? Math.min(...node.dataWindow) : value,
                        max: node.dataWindow.length > 0 ? Math.max(...node.dataWindow) : value,
                        data_points: node.dataWindow.length,
                        error: node.dataWindow.length < 3 ? "Need 3+ points" : null,
                       
                    };
                }
                
                // Добавляем текущее значение в выходные данные               
                trendData.window_size = node.windowSize;
                trendData.value_added = valueAdded;
                
                // Создаем JSON выход
                const jsonOutput = {
                    payload: trendData,
                    topic: msg.topic || "trend_data",
                    timestamp: currentTime,
                    originalPayload: value
                };
                
                // Отправляем выходные сообщения
                const outputs = [                    
                   {payload: trendData.angle, topic: "trend_angle"}, // 1. Угол тренда
                   jsonOutput // 2. JSON со всеми данными
                ];
                
                send(outputs);
                
                // Логирование для отладки
                if (valueAdded) {
                    node.debug(`Window: ${node.dataWindow.length}/${node.windowSize}, ` +
                             `Angle: ${trendData.angle}°, ` +
                             `Min: ${trendData.min}, Max: ${trendData.max}, ` +
                             `Amplitude: ${trendData.amplitude}`);
                }
                
            } catch (error) {
                node.error("Error in TrendAnalyzer: " + error.message, msg);
            }
            
            if (done) {
                done();
            }
        });
        
        // Очистка при деактивации
        node.on('close', function() {
            node.dataWindow = [];
            node.timestamps = [];
        });
    }
    
    RED.nodes.registerType("trend-analyzer", TrendAnalyzerNode);
};