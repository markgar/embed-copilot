#!/usr/bin/env node

/**
 * Quick OpenAI Service Validation Script
 * Tests key scenarios to ensure the service is working with your prompt engineering
 */

const request = require('supertest');

// Test scenarios that capture the core functionality
const testScenarios = [
    {
        name: 'Schema Inquiry',
        message: 'show me the fields',
        expectChartAction: false,
        expectResponseContains: ['field', 'Sales', 'Time', 'District']
    },
    {
        name: 'Simple Chart Creation',
        message: 'show me sales by district',
        expectChartAction: true,
        expectAxisAssignment: { yContains: 'Sales', xContains: 'District', chartType: 'columnChart' }
    },
    {
        name: 'Time-based Chart',
        message: 'show me sales by month',
        expectChartAction: true,
        expectAxisAssignment: { yContains: 'Sales', xContains: 'Month', chartType: ['lineChart', 'columnChart'] }
    },
    {
        name: 'Bar Chart with Axis Swap',
        message: 'bar chart of sales by district',
        expectChartAction: true,
        expectAxisAssignment: { yContains: 'District', xContains: 'Sales', chartType: 'barChart' }
    },
    {
        name: 'Units Chart Creation',
        message: 'show me units by district',
        expectChartAction: true,
        expectAxisAssignment: { yContains: 'TotalUnits', xContains: 'District', chartType: 'columnChart' }
    },
    {
        name: 'Ambiguous Request',
        message: 'show me sales',
        expectChartAction: false,
        expectResponseContains: ['which', 'grouping']
    }
];

async function runValidation() {
    console.log('🚀 OpenAI Service Validation\n');
    
    let app;
    try {
        process.env.NODE_ENV = 'test';
        app = require('../src-v2/app.js');
    } catch (error) {
        console.log('❌ Failed to load app:', error.message);
        process.exit(1);
    }

    let passed = 0;
    let failed = 0;

    for (const scenario of testScenarios) {
        console.log(`--- ${scenario.name} ---`);
        console.log(`Query: "${scenario.message}"`);

        try {
            const response = await request(app)
                .post('/chat')
                .send({ message: scenario.message });

            if (response.status !== 200) {
                console.log(`❌ HTTP ${response.status}: ${JSON.stringify(response.body)}`);
                failed++;
                continue;
            }

            let parsedResponse;
            try {
                parsedResponse = JSON.parse(response.body.response);
            } catch (e) {
                console.log('❌ Response is not valid JSON');
                failed++;
                continue;
            }

            // Validate basic structure
            if (!parsedResponse.chatResponse) {
                console.log('❌ Missing chatResponse field');
                failed++;
                continue;
            }

            // Validate chart action expectation
            if (scenario.expectChartAction) {
                if (!parsedResponse.chartAction) {
                    console.log('❌ Expected chartAction but none found');
                    failed++;
                    continue;
                }

                const chartAction = parsedResponse.chartAction;
                if (!chartAction.yAxis || !chartAction.xAxis || !chartAction.chartType) {
                    console.log('❌ chartAction missing required fields');
                    failed++;
                    continue;
                }

                // Validate axis assignment if specified
                if (scenario.expectAxisAssignment) {
                    const expected = scenario.expectAxisAssignment;
                    let axisValid = true;

                    if (expected.yContains && !chartAction.yAxis.includes(expected.yContains)) {
                        console.log(`❌ Y-axis should contain "${expected.yContains}", got "${chartAction.yAxis}"`);
                        axisValid = false;
                    }

                    if (expected.xContains && !chartAction.xAxis.includes(expected.xContains)) {
                        console.log(`❌ X-axis should contain "${expected.xContains}", got "${chartAction.xAxis}"`);
                        axisValid = false;
                    }

                    if (expected.chartType) {
                        const expectedTypes = Array.isArray(expected.chartType) ? expected.chartType : [expected.chartType];
                        if (!expectedTypes.includes(chartAction.chartType)) {
                            console.log(`❌ Chart type should be one of ${expectedTypes.join(', ')}, got "${chartAction.chartType}"`);
                            axisValid = false;
                        }
                    }

                    if (!axisValid) {
                        failed++;
                        continue;
                    }
                }

                console.log('✅ Chart Action:', JSON.stringify(chartAction, null, 2));
            } else {
                if (parsedResponse.chartAction) {
                    console.log('❌ Unexpected chartAction found:', JSON.stringify(parsedResponse.chartAction, null, 2));
                    failed++;
                    continue;
                }
            }

            // Validate response contains expected content
            if (scenario.expectResponseContains) {
                let contentValid = true;
                for (const expectedContent of scenario.expectResponseContains) {
                    if (!parsedResponse.chatResponse.toLowerCase().includes(expectedContent.toLowerCase())) {
                        console.log(`❌ Response should contain "${expectedContent}"`);
                        contentValid = false;
                    }
                }
                if (!contentValid) {
                    failed++;
                    continue;
                }
            }

            console.log('✅ PASSED');
            console.log(`Response: ${parsedResponse.chatResponse.substring(0, 100)}${parsedResponse.chatResponse.length > 100 ? '...' : ''}`);
            passed++;

        } catch (error) {
            console.log('❌ Error:', error.message);
            failed++;
        }

        console.log('');
    }

    console.log('📊 VALIDATION SUMMARY');
    console.log('═'.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total: ${passed + failed}`);

    if (failed === 0) {
        console.log('\n🎉 ALL VALIDATIONS PASSED! OpenAI service is working correctly.');
        process.exit(0);
    } else {
        console.log('\n⚠️  SOME VALIDATIONS FAILED! Check the output above.');
        process.exit(1);
    }
}

// Context validation with current chart
async function runContextValidation() {
    console.log('\n🔄 Testing Chart Context Functionality');
    
    let app;
    try {
        process.env.NODE_ENV = 'test';
        app = require('../src-v2/app.js');
    } catch (error) {
        console.log('❌ Failed to load app:', error.message);
        return false;
    }

    const currentChart = {
        yAxis: 'Sales.TotalSales',
        xAxis: 'District.District',
        chartType: 'columnChart'
    };

    try {
        const response = await request(app)
            .post('/chat')
            .send({ 
                message: 'change it to a bar chart',
                currentChart: currentChart
            });

        if (response.status !== 200) {
            console.log('❌ Context test failed:', response.status);
            return false;
        }

        const parsedResponse = JSON.parse(response.body.response);
        const newChart = parsedResponse.chartAction;

        if (!newChart) {
            console.log('❌ No chart action in context response');
            return false;
        }

        // Should swap axes for column->bar conversion
        if (newChart.yAxis === 'District.District' && newChart.xAxis === 'Sales.TotalSales' && newChart.chartType === 'barChart') {
            console.log('✅ Chart context working correctly');
            console.log(`   Original: ${JSON.stringify(currentChart)}`);
            console.log(`   Updated:  ${JSON.stringify(newChart)}`);
            return true;
        } else {
            console.log('❌ Chart context not working properly');
            console.log(`   Expected: yAxis="District.District", xAxis="Sales.TotalSales", chartType="barChart"`);
            console.log(`   Got:      ${JSON.stringify(newChart)}`);
            return false;
        }
    } catch (error) {
        console.log('❌ Context test error:', error.message);
        return false;
    }
}

// Main execution
async function main() {
    await runValidation();
    const contextPassed = await runContextValidation();
    
    if (!contextPassed) {
        console.log('\n⚠️  Chart context functionality failed');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { runValidation, runContextValidation };