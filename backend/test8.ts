import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = 'https://api.serpstat.com/v4?token=' + process.env.SERPSTAT_API_TOKEN;

async function test(method: string, params: any = {}) {
    try {
        const res = await axios.post(url, { id: 1, method, params });
        const msg = res.data?.error?.message;
        if (msg && msg !== 'Method not found') {
            console.log('FOUND:', method, res.data);
        } else if (!msg) {
            console.log('SUCCESS:', method);
        }
    } catch (e: any) {
    }
}

async function run() {
    const methods = [
        'RtKeywordProcedure.getProjectKeywords',
        'RtApiProjectProcedure.getKeywordsGroupedByTags',
        'RtApiProjectProcedure.getTagsSummary',
    ];

    for (const m of methods) {
        await test(m, { projectId: 1171287 });
    }
}
run();
