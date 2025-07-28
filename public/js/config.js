const config = {
    development: {
        API_BASE_URL: 'http://localhost:3000/api'
    },
    production: {
        API_BASE_URL: 'https://ai-plus-education.onrender.com/api'
    }
};

const environment = window.location.hostname === 'localhost' ? 'development' : 'production';
export const API_BASE_URL = config[environment].API_BASE_URL;

// ApiService class for making authenticated API requests
export class ApiService {
    static getToken() {
        return localStorage.getItem('authToken');
    }

    static async makeRequest(url, options = {}) {
        try {
            const token = this.getToken();
            const response = await fetch(`${API_BASE_URL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : '',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    static async getProfile() {
        return await this.makeRequest('/user/profile');
    }

    static async getTestHistory() {
        return await this.makeRequest('/user/test-history');
    }

    static async getQuestions(testType, practiceSet) {
        return await this.makeRequest(`/questions/test?testType=${testType}&practiceSet=${practiceSet}`);
    }
} 