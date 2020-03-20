var express = require('express');
var bodyParser = require('body-parser');
var mysql = require('mysql');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Setting for Hyperledger Fabric
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const path = require('path');
const ccpPath = path.resolve(__dirname, '..','car-network', 'connection.json');

app.post('/registerUserGlass/', async function (req, res) {

    
    const userName = req.body.Username;
    const passWord = req.body.Password;
    console.log(req.body.Organization);

    try {


        var con = mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "2121",
            database: "users"
          });

        con.connect(function(err) {
            if (err) throw err;
            console.log("Connected to users database");
            var sql = `INSERT INTO usercredentials VALUES ('${userName}', '${passWord}');`;
            con.query(sql, function (err, result) {
              if (err) throw err;
              console.log("1 record inserted");
            });
          });


        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
       

        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);
        
        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists(userName);
        if (userExists) {
            console.log(`An identity for the user ${userName} already exists in the wallet`);
            return;
        }

        // Check to see if we've already enrolled the admin user.
        const adminExists = await wallet.exists('admin');
        if (!adminExists) {
            console.log('An identity for the admin user "admin" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccpPath, { wallet, identity: 'admin', discovery: { enabled: true, asLocalhost: true } });

        // Get the CA client object from the gateway for interacting with the CA.
        const ca = gateway.getClient().getCertificateAuthority();
        const adminIdentity = gateway.getCurrentIdentity();

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({ enrollmentID: userName , role: 'client' }, adminIdentity);
        const enrollment = await ca.enroll({ enrollmentID: userName, enrollmentSecret: secret });
        const userIdentity = X509WalletMixin.createIdentity('Glass1MSP', enrollment.certificate, enrollment.key.toBytes());
        await wallet.import( req.body.Username, userIdentity);
        console.log(`Successfully registered and enrolled admin user ${userName} and imported it into the wallet`);
        console.log(req.body.Password);
        console.log(req.body.selectpicker);

        res.sendFile(path.join(__dirname+'/success.html'));

    } catch (error) {
        console.error(`Failed to register user ${userName} : ${error}`);
        process.exit(1);
    }
})

app.post('/loginUserGlass/', async function (req, res) { 
    const userName = req.body.Username;
    const passWord = req.body.Password;
    const pass='';

    try{
      var con = mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "2121",
        database: "users"
      });

      con.connect(function(err) {
        console.log("Connection established!")
        if (err) throw err;
        con.query(`SELECT password FROM usercredentials WHERE username = '${userName}'`, function (err, result) {
          if (err) throw err;
          console.log(result[0].password);
          
          pass = result[0].password;
          console.log(pass);
        });
      });
      
      if(passWord.localeCompare(pass)){
        res.sendFile(path.join(__dirname+'/mainmenu.html'));
      }
     
      console.log("tryblock");
    }catch(error){
      console.error(`Failed to login user ${userName} : ${error}`);
     process.exit(1);
    }
    
})



var port = 8000;
app.listen(port, function() {
    console.log('Listening on port ' + port);
  });
