exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/admin/login');
};

exports.isGuest = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/admin/dashboard');
    }
    next();
};