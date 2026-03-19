import { createClient } from '../supabase/client';

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  module: string;
  type: string;
  created_at: string;
}

export const activityService = {
  async getRecentActivities(limit: number = 5): Promise<ActivityLog[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }
    
    return data || [];
  },

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${Math.max(1, seconds)} detik yang lalu`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} menit yang lalu`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam yang lalu`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} hari yang lalu`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} bulan yang lalu`;
    
    const years = Math.floor(months / 12);
    return `${years} tahun yang lalu`;
  }
};
