import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function test(method: string, params: any = {}) {
    try {
        const res = await axios.post(url, { id: 1, method, params });
        console.log(method, '->', res.data?.error?.message || 'SUCCESS!');
    } catch (e: any) {
        console.log(method, '-> axios error');
    }
}

async function run() {
    const methods = [
        'RtApiCompetitorProcedure.getProjectCompetitors',
        'RtApiProjectProcedure.getCompetitors',
        'RtApiCompetitorProcedure.getCompetitors',
        'RtCompetitorProcedure.getProjectCompetitors',
        'RtCompetitorProcedure.getCompetitors',
        'RtApiProjectProcedure.getCompetitors',
        'RtApiProjectProcedure.getProjectCompetitors',
        'RtApiDomainProcedure.getOrganicCompetitorsPage',
        'RtApiSiteProcedure.getCompetitors',
    ];

    for (const m of methods) {
        await test(m, { projectId: 1171287 });
        // avoid rate limit
        await new Promise(r => setTimeout(r, 1000));
    }
}
run();
