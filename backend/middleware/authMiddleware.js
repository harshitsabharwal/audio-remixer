const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. Get the token from the request header
    const token = req.header('Authorization')?.split(' ')[1]; 

    // 2. If no token is found, reject the request
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // 3. Verify the token using your secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 4. Attach the user's ID to the request so the routes can use it
        req.user = decoded; 
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};