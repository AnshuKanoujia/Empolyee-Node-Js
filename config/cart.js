module.exports = function Cart(cart) {
    this.users = cart.users || [];
    this.usersDistance = cart.usersDistance || [];
    this.usersRates = cart.usersRates || [];
    this.totalUsers = cart.totalUsers || 0;

    this.add = function (users, id, Distance, rates) {
        var usersList = id;
        var usersListDistance = Distance;
        var usersListRates = rates;
        this.totalUsers++;
        this.users.push(usersList);
        this.usersDistance.push(usersListDistance);
        this.usersRates.push(usersListRates);
        // this.usersRates.push(usersListRates);
        // this.users.push(usersList);function (user) 
    };

    this.addUsersToCart = function (users, id, Distance, rates) {
        var usersList = id;
        var usersListDistance = Distance;
        var usersListRates = rates;
        this.totalUsers++;
        this.users.push(usersList);
        this.usersDistance.push(usersListDistance);
        this.usersRates.push(usersListRates);
        console.log(usersList,'ul',usersListDistance,'uld',usersListRates,'ulr')
    };

    this.remove = function (id) {
        if (this.totalUsers != 0) {
            this.totalUsers--;
        }
        var index = this.users.indexOf(id);
        if (index > -1) {
            this.users.splice(index, 1);
            this.usersDistance.splice(index, 1);
            this.usersRates.splice(index, 1);
        }
    };

};