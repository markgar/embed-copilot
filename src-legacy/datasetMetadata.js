/**
 * DatasetMetadata Service
 * Returns hardcoded metadata for the Store Sales dataset
 */
class DatasetMetadata {
    constructor(config) {
        // Config parameter maintained for compatibility but not used
        this.config = config;
    }

    /**
     * Get complete dataset metadata
     * @param {string} groupId - Power BI group ID (ignored in hardcoded version)
     * @param {string} datasetId - Power BI dataset ID (ignored in hardcoded version)
     * @returns {Object} Complete metadata for all tables
     */
    async getCompleteDatasetMetadata(groupId, datasetId) {
        const tables = [
            {
                name: "Sales",
                type: "fact",
                columns: [
                    { name: "TotalUnits", type: "number", description: "Total units sold" },
                    { name: "TotalSales", type: "currency", description: "Total sales amount" }
                ]
            },
            {
                name: "Time",
                type: "dimension",
                columns: [
                    { name: "Month", type: "date", description: "Month of the year" },
                    { name: "FiscalMonth", type: "text", description: "Fiscal month" },
                    { name: "FiscalYear", type: "number", description: "Fiscal year" },
                    { name: "Year", type: "number", description: "Calendar year" },
                    { name: "Quarter", type: "text", description: "Calendar quarter" },
                    { name: "Day", type: "date", description: "Day of the month" }
                ]
            },
            {
                name: "District",
                type: "dimension",
                columns: [
                    { name: "District", type: "text", description: "Sales district name" },
                    { name: "DM", type: "text", description: "District Manager" }
                ]
            },
            {
                name: "Item",
                type: "dimension",
                columns: [
                    { name: "Category", type: "text", description: "Product category" },
                    { name: "Segment", type: "text", description: "Product segment classification" },
                    { name: "Buyer", type: "text", description: "Product buyer" },
                    { name: "FamilyName", type: "text", description: "Product family name" }
                ]
            },
            {
                name: "Store",
                type: "dimension",
                columns: [
                    { name: "Chain", type: "text", description: "Store chain name" },
                    { name: "City", type: "text", description: "Store city location" },
                    { name: "Name", type: "text", description: "Store name" },
                    { name: "Store Type", type: "text", description: "Type of store" },
                    { name: "Territory", type: "geography", description: "Store territory" }
                ]
            }
        ];

        // Derive measures & dimensions arrays so the server logs have data
        const measures = [
            { table: "Sales", name: "TotalSales", dataType: "currency", description: "Total sales amount" },
            { table: "Sales", name: "TotalUnits", dataType: "number", description: "Total units sold" }
        ];

        const dimensions = [
            { table: "Time", name: "Month", dataType: "date", description: "Month of the year" },
            { table: "Time", name: "FiscalMonth", dataType: "text", description: "Fiscal month" },
            { table: "Time", name: "FiscalYear", dataType: "number", description: "Fiscal year" },
            { table: "Time", name: "Year", dataType: "number", description: "Calendar year" },
            { table: "Time", name: "Quarter", dataType: "text", description: "Calendar quarter" },
            { table: "Time", name: "Day", dataType: "date", description: "Day of the month" },
            { table: "District", name: "District", dataType: "text", description: "Sales district name" },
            { table: "District", name: "DM", dataType: "text", description: "District Manager" },
            { table: "Item", name: "Category", dataType: "text", description: "Product category" },
            { table: "Item", name: "Segment", dataType: "text", description: "Product segment classification" },
            { table: "Item", name: "Buyer", dataType: "text", description: "Product buyer" },
            { table: "Item", name: "FamilyName", dataType: "text", description: "Product family name" },
            { table: "Store", name: "Chain", dataType: "text", description: "Store chain name" },
            { table: "Store", name: "City", dataType: "text", description: "Store city location" },
            { table: "Store", name: "Name", dataType: "text", description: "Store name" },
            { table: "Store", name: "Store Type", dataType: "text", description: "Type of store" },
            { table: "Store", name: "Territory", dataType: "geography", description: "Store territory" }
        ];

        return {
            dataset: { name: "Store Sales" },
            lastUpdated: new Date().toISOString(),
            tables,
            measures,
            dimensions
        };
    }

    /**
     * Get simplified metadata for AI prompts
     * @returns {string} Simplified metadata as formatted text
     */
    async getSimplifiedMetadata() {
        const metadata = await this.getCompleteDatasetMetadata();
        
        let result = `Dataset: ${metadata.dataset?.name || 'Unknown'}\nLast Updated: ${metadata.lastUpdated}\n\nTables:\n`;

        for (const table of metadata.tables) {
            result += `- ${table.name} (${table.type}):\n`;
            for (const column of table.columns) {
                result += `  - ${column.name} (${column.type}): ${column.description}\n`;
            }
        }

        if (metadata.measures?.length) {
            result += `\nMeasures:\n`;
            for (const m of metadata.measures) {
                result += `- ${m.name} (table: ${m.table}, type: ${m.dataType}): ${m.description}\n`;
            }
        }

        if (metadata.dimensions?.length) {
            result += `\nDimensions:\n`;
            for (const d of metadata.dimensions) {
                result += `- ${d.name} (table: ${d.table}, type: ${d.dataType}): ${d.description}\n`;
            }
        }

        return result;
    }

    /**
     * Get a minimal name-only schema list for LLM grounding.
     * Returns a compact multi-line string with ONLY table and column names (and optional types) so the
     * system prompt can strongly constrain the model to valid field names.
     * Example:
     * SCHEMA (table.column [type]):
     * Sales.TotalUnits [number]
     * Sales.TotalSales [currency]
     * Time.Month [date]
     * District.District [text]
     * Item.Category [text]
     * Item.Segment [text]
     */
    async getNameOnlySchema() {
        const metadata = await this.getCompleteDatasetMetadata();
        const lines = [];
        for (const table of metadata.tables) {
            for (const col of table.columns) {
                lines.push(`${table.name}.${col.name} [${col.type}]`);
            }
        }
        return lines.join('\n');
    }
}

module.exports = DatasetMetadata;
