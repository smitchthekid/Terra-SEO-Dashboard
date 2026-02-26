import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function test(method: string, params: any = {}) {
    try {
        const res = await axios.post(url, { id: 1, method, params });
        console.log(method, '->', JSON.stringify(res.data).substring(0, 1000));
    } catch (e: any) {
        console.log(method, '-> axios error');
    }
}

async function run() {
    await test('RtApiSerpResultsProcedure.getUrlsSerpResultsHistory', {
        projectId: 1171287,
        projectRegionId: 379658,
        dateFrom: '2025-01-01',
        dateTo: '2026-02-25',
        page: 1,
        pageSize: 20
    });
}
run();
