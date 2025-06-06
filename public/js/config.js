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