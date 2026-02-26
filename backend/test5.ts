import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function test(method: string, params: any = {}) {
    try {
        const res = await axios.post(url, { id: 1, method, params });
        console.log(method, '->', JSON.stringify(res.data).substring(0, 500));
    } catch (e: any) {
        console.log(method, '-> axios error');
    }
}

async function run() {
    await test('RtApiKeywordProcedure.getProjectKeywords', { projectId: 1171287, limit: 10 });
    await test('RtProjectKeywordProcedure.getProjectKeywords', { projectId: 1171287, limit: 10 });
}
run();
