const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
    res.send('Secure Pipeline Active!');
});

// An intentional code smell for SonarQube to notice (unused variable)
const unusedSecretKey = "never_hardcode_secrets_here"; 

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
