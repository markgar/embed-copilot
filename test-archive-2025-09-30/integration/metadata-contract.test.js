const request = require('supertest');
const app = require('../../src-v2/app.js');

describe('Metadata API Contract', () => {
  // Set a longer timeout for this test suite if needed, as it involves app startup
  // jest.setTimeout(10000);

  beforeAll(() => {
    // Ensure the environment is set to 'test'
    process.env.NODE_ENV = 'test';
  });

  test('GET /getDatasetMetadata should return a valid metadata object', async () => {
    const response = await request(app).get('/getDatasetMetadata');

    // 1. Assert the HTTP status is 200
    expect(response.status).toBe(200);
    
    // 2. Validate the top-level properties exist
    expect(response.body).toHaveProperty('dataset');
    expect(response.body).toHaveProperty('tables');
    expect(response.body).toHaveProperty('measures');
    expect(response.body).toHaveProperty('dimensions');
    expect(response.body).toHaveProperty('lastUpdated');

    // Ensure arrays are arrays
    expect(Array.isArray(response.body.tables)).toBe(true);
    expect(Array.isArray(response.body.measures)).toBe(true);
    expect(Array.isArray(response.body.dimensions)).toBe(true);

    // 3. Validate the shape of the first item in the 'tables' array
    if (response.body.tables.length > 0) {
      const firstTable = response.body.tables[0];
      expect(firstTable).toHaveProperty('name');
      expect(typeof firstTable.name).toBe('string');
      expect(firstTable).toHaveProperty('columns');
      expect(Array.isArray(firstTable.columns)).toBe(true);

      // 4. Validate the shape of the first item in the 'columns' array within a table
      if (firstTable.columns.length > 0) {
        const firstColumn = firstTable.columns[0];
        expect(firstColumn).toHaveProperty('name');
        expect(typeof firstColumn.name).toBe('string');
        expect(firstColumn).toHaveProperty('type');
        expect(typeof firstColumn.type).toBe('string');
        expect(firstColumn).toHaveProperty('description');
        expect(typeof firstColumn.description).toBe('string');
      }
    }

    // 5. Validate the shape of the first measure and dimension
    if (response.body.measures.length > 0) {
      const firstMeasure = response.body.measures[0];
      expect(firstMeasure).toHaveProperty('table');
      expect(firstMeasure).toHaveProperty('name');
      expect(firstMeasure).toHaveProperty('dataType');
      expect(firstMeasure).toHaveProperty('description');
    }

    if (response.body.dimensions.length > 0) {
      const firstDimension = response.body.dimensions[0];
      expect(firstDimension).toHaveProperty('table');
      expect(firstDimension).toHaveProperty('name');
      expect(firstDimension).toHaveProperty('dataType');
      expect(firstDimension).toHaveProperty('description');
    }
  });
});
