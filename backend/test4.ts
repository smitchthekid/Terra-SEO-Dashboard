import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function run() {
    const regions = await axios.post(url, { id: 1, method: 'RtApiSearchEngineProcedure.getProjectRegions', params: { projectId: 1171287 } });
    const regionId = regions.data.result.regions[0].id;
    console.log('Using regionId:', regionId);

    const res = await axios.post(url, {
        id: 2, method: 'RtApiSerpResultsProcedure.getUrlsSerpResultsHistory', params: {
            projectId: 1171287,
            projectRegionId: regionId,
            dateFrom: '2026-01-01',
            dateTo: '2026-02-25',
            page: 1,
            pageSize: 20
        }
    });
    console.log(JSON.stringify(res.data.result).substring(0, 1000));
}
run();
