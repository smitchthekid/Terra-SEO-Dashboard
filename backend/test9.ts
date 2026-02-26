import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function run() {
    const req = {
        id: 1,
        method: 'RtApiSerpResultsProcedure.getUrlsSerpResultsHistory',
        params: {
            projectId: 1171287,
            projectRegionId: 356297,
            dateFrom: '2026-01-01',
            dateTo: '2026-02-25',
            page: 1,
            pageSize: 20
        }
    };
    const res = await axios.post(url, req);
    console.log(res.data.result.data.keywords[0]);
}
run();
