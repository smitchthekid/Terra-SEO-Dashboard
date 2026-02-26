import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function test(method: string, params: any = {}) {
    try {
        const res = await axios.post(url, { id: 1, method, params });
        console.log(method, '->', res.data);
    } catch (e: any) {
        console.log(method, '-> axios error:', e.message);
    }
}

async function run() {
    console.log("Testing properties with projectID: 1171287");
    await test('RtApiSearchEngineProcedure.getProjectSearchEngines', { projectId: 1171287 });
    await test('RtApiSearchEngineProcedure.getProjectSearchEngines', { project_id: 1171287 });
    await test('RtApiSearchEngineProcedure.getProjectRegions', { projectId: 1171287 });
    await test('SerpstatRankTrackerProcedure.getProjectRegions', { projectId: 1171287 });
    await test('RtApiProjectProcedure.getProjectRegions', { projectId: 1171287 });
    await test('RtApiCompetitorProcedure.getProjectCompetitors', { projectId: 1171287 });
    await test('SerpstatDomainProcedure.getOrganicCompetitorsPage', { domain: 'terrauniversal.com' });
    await test('SerpstatUrlProcedure.getUrlCompetitors', { url: 'https://www.terrauniversal.com/' });
}
run();
