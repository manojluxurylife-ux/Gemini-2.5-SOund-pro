
export interface Client {
  id?: number;
  name: string;
  phone?: string;
  case_number?: string;
  court?: string;
  next_date?: string;
  purpose?: string;
}

export interface KnowledgeItem {
  id?: number;
  title: string;
  content: string;
  category?: string;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  context?: string;
}

export const LegalApiService = {
  async getClients(): Promise<Client[]> {
    const res = await fetch('/api/clients');
    if (!res.ok) throw new Error('Failed to fetch clients');
    return res.json();
  },

  async addClient(client: Client): Promise<{ id: number }> {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(client)
    });
    if (!res.ok) throw new Error('Failed to add client');
    return res.json();
  },

  async getKnowledge(): Promise<KnowledgeItem[]> {
    const res = await fetch('/api/knowledge');
    if (!res.ok) throw new Error('Failed to fetch knowledge');
    return res.json();
  },

  async addKnowledge(item: KnowledgeItem): Promise<{ id: number }> {
    const res = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) throw new Error('Failed to add knowledge');
    return res.json();
  },

  async getChatHistory(context?: string): Promise<ChatMessage[]> {
    const url = context ? `/api/chat?context=${encodeURIComponent(context)}` : '/api/chat';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return res.json();
  },

  async addChatMessage(msg: ChatMessage): Promise<{ id: number }> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    });
    if (!res.ok) throw new Error('Failed to add chat message');
    return res.json();
  }
};
