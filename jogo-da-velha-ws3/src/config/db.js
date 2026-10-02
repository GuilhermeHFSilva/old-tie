import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_JSON_PATH || path.join(__dirname, '../../database/data.json');

// Garante que o diretório e o arquivo JSON existam
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const defaultStructure = {
    jogadores: [],
    salas: [],
    partidas: [],
    jogadas: [],
    mensagensChat: []
};

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultStructure, null, 2), 'utf8');
}

export async function readData() {
    try {
        const content = await fs.promises.readFile(dbPath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error('Erros ao ler data.json:', err.message);
        return defaultStructure;
    }
}

export async function writeData(data) {
    try {
        await fs.promises.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Erro ao escrever em data.json:', err.message);
    }
}

export async function queryCollection(collectionName, filterFn = () => true) {
    const data = await readData();
    const list = data[collectionName] || [];
    return list.filter(filterFn);
}

export async function insertRecord(collectionName, record) {
    const data = await readData();
    if (!data[collectionName]) {
        data[collectionName] = [];
    }

    const newId = (data[collectionName].length > 0)
        ? Math.max(...data[collectionName].map(item => item.id || 0)) + 1
        : 1;

    const recordWithId = {
        id: newId,
        ...record,
        created_at: record.created_at || new Date().toISOString()
    };

    data[collectionName].push(recordWithId);
    await writeData(data);
    return recordWithId;
}

export async function updateRecord(collectionName, filterFn, updateData) {
    const data = await readData();
    if (!data[collectionName]) return null;

    let updatedItem = null;
    data[collectionName] = data[collectionName].map(item => {
        if (filterFn(item)) {
            updatedItem = { ...item, ...updateData, updated_at: new Date().toISOString() };
            return updatedItem;
        }
        return item;
    });

    if (updatedItem) {
        await writeData(data);
    }
    return updatedItem;
}
