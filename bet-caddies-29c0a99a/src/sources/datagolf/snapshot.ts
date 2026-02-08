import axios from 'axios';

export interface DataGolfSnapshot {
  tournamentId: string;
  timestamp: string;
  players: any[];
}

export async function loadDataGolfSnapshot(tournamentId: string): Promise<DataGolfSnapshot> {
  const apiKey = process.env.DATAGOLF_API_KEY;
  if (!apiKey) throw new Error('DATAGOLF_API_KEY missing');

  const res = await axios.get('https://api.datagolf.com/tournament-data', {
    params: { tournament_id: tournamentId, key: apiKey }
  });

  if (!res.data || !res.data.players) {
    throw new Error('Invalid DataGolf response');
  }

  return {
    tournamentId,
    timestamp: new Date().toISOString(),
    players: res.data.players
  };
}
