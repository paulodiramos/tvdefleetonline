// Simple test script for debugging the save issue
console.log("TESTE CRITICO DO BUG DE GRAVACAO - INICIANDO");

// Login as parceiro
console.log("1. Login como parceiro");
await page.goto('https://partner-reports-1.preview.emergentagent.com/login');
await page.waitForSelector('input[type="email"]');

await page.fill('input[type="email"]', 'parceiro@tvdefleet.com');
await page.fill('input[type="password"]', 'UQ1B6DXU');
await page.click('button[type="submit"]');

await page.waitForURL('**/dashboard');
console.log("Login bem-sucedido");

// Navigate to Vehicles
console.log("2. Navegando para Veiculos");
await page.goto('https://partner-reports-1.preview.emergentagent.com/vehicles');
await page.waitForSelector('[data-testid="vehicles-page"]', { timeout: 10000 });
console.log("Pagina de veiculos carregada");

// Click on first vehicle
console.log("3. Clicando no primeiro veiculo");
await page.waitForSelector('button:has-text("Ver Ficha")', { timeout: 5000 });
await page.click('button:has-text("Ver Ficha")');

await page.waitForSelector('h1:has-text("Ficha do Veículo")', { timeout: 10000 });
console.log("Ficha do veiculo carregada");

// Activate edit mode
console.log("4. Ativando modo de edicao");
await page.waitForSelector('button:has-text("Editar")', { timeout: 5000 });
await page.click('button:has-text("Editar")');

await page.waitForSelector('button:has-text("Guardar")', { timeout: 5000 });
console.log("Modo de edicao ativado");

// Change field
console.log("5. Alterando campo Cartao Frota Eletrico ID");

const cartaoFrotaInput = page.locator('label:has-text("Cartão Frota Elétrico ID")').locator('..').locator('input');
await cartaoFrotaInput.waitFor({ timeout: 5000 });

await cartaoFrotaInput.clear();
await cartaoFrotaInput.fill('DEBUG-TEST-123');
console.log("Campo alterado para DEBUG-TEST-123");

// Set up console log capture
console.log("6. Capturando logs do console");

const consoleLogs = [];
page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log('CONSOLE: ' + text);
});

// Click save button
await page.click('button:has-text("Guardar")');
await page.waitForTimeout(3000);

// Analyze logs
console.log("7. ANALISE DOS LOGS");

const handleSaveInfoLogs = consoleLogs.filter(log => log.includes('handleSaveInfo iniciado'));
const payloadLogs = consoleLogs.filter(log => log.includes('Payload a enviar'));
const responseLogs = consoleLogs.filter(log => log.includes('Resposta do servidor'));
const errorLogs = consoleLogs.filter(log => log.includes('Error'));

console.log('RESULTADOS:');
console.log('- handleSaveInfo iniciado: ' + handleSaveInfoLogs.length);
console.log('- Payload a enviar: ' + payloadLogs.length);
console.log('- Resposta do servidor: ' + responseLogs.length);
console.log('- Errors: ' + errorLogs.length);

if (handleSaveInfoLogs.length > 0) {
    console.log("FUNCAO handleSaveInfo FOI EXECUTADA");
    handleSaveInfoLogs.forEach(log => console.log('   ' + log));
    
    if (payloadLogs.length > 0) {
        console.log("PAYLOAD FOI ENVIADO");
    }
    
    if (responseLogs.length > 0) {
        console.log("RESPOSTA RECEBIDA");
    }
    
    if (errorLogs.length > 0) {
        console.log("ERROS ENCONTRADOS:");
        errorLogs.forEach(log => console.log('   ' + log));
    }
} else {
    console.log("FUNCAO handleSaveInfo NAO FOI EXECUTADA");
    console.log("PROBLEMA: Botao Guardar nao chama handleSaveInfo()");
}

const jsErrors = consoleLogs.filter(log => 
    log.toLowerCase().includes('error') || 
    log.toLowerCase().includes('uncaught') ||
    log.toLowerCase().includes('exception')
);

if (jsErrors.length > 0) {
    console.log("ERROS JAVASCRIPT:");
    jsErrors.forEach(error => console.log('   ' + error));
} else {
    console.log("Nenhum erro JavaScript encontrado");
}

await page.screenshot({ 
    path: '.screenshots/debug-save-test.png', 
    quality: 40, 
    fullPage: false 
});

// Check persistence
console.log("8. Verificando persistencia");
await page.reload();
await page.waitForSelector('h1:has-text("Ficha do Veículo")', { timeout: 10000 });

const currentValue = await page.locator('label:has-text("Cartão Frota Elétrico ID")').locator('..').locator('p').textContent();
console.log('Valor apos reload: "' + currentValue + '"');

if (currentValue && currentValue.includes('DEBUG-TEST-123')) {
    console.log("DADOS PERSISTIRAM");
} else {
    console.log("DADOS NAO PERSISTIRAM");
}

console.log("TESTE COMPLETO");