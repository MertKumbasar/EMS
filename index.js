import express from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const app = express();
const port = process.env.PORT || 3000; 

dotenv.config();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Use your own mySQL database info here
const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});


// Get todays date
const today = new Date();

const year = today.getFullYear();
const month = today.getMonth() + 1; 
const day = today.getDate();

const formattedDate = `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year}`;


//array to hold the information about employees
let emp_list = [];

// Routes
app.get('/', async (req, res) => {
  try {
    [emp_list] = await db.query('SELECT * FROM employee_info');
    
    res.render('home.ejs',{emp_list: emp_list, date: formattedDate, emp_id_list: emp_list});
  } catch (error) {
    console.error('Error querying employee IDs:', error);
  }
});

app.post('/getEmpInfo', async (req, res) => {
  const employeeId = parseInt(req.body.id);
  const emp_info = emp_list[emp_list.findIndex((element) => {return (element.EmpID === employeeId)})]

  try {
    const [registerTime_list] = await db.query('SELECT * FROM employee_register_time WHERE ID = ?',[employeeId]);
    
    res.render('home.ejs', { emp_info: emp_info, registerTime_list: registerTime_list, date: formattedDate, emp_id_list:emp_list});
  } catch (error) {
    console.error('Error querying the database:', error);
    res.status(500).send('Error querying the database');
  }
});

app.post('/getEmpInfo/addDb/:id', async (req, res) => {
  let flag = 1; // flag value to stop adding the same data twice
  const employeeId = parseInt(req.params.id);
  const sqlQuery = `
  SELECT ID, SEC_TO_TIME(SUM(TIME_TO_SEC(exit_time) - TIME_TO_SEC(entrance_time))) AS total_worked_time
  FROM (
    SELECT ID,
           card_time AS entrance_time,
           LEAD(card_time) OVER (PARTITION BY ID ORDER BY card_time) AS exit_time
    FROM employee_register_time
  ) AS subquery
  WHERE ID = ?;
`; // sql query to find the time differnce
  try {
    const [total_work_allTime] = await db.query('SELECT * FROM total_work_done WHERE ID = ?',[employeeId]);
    total_work_allTime.forEach((element) => {
      if(element.date === formattedDate){
        flag = 0;
      }
    })
    if(flag === 1){
      let [data] = await db.query(sqlQuery,[employeeId])
      data = data[0];
      
      await db.query('INSERT INTO total_work_done (ID,total_work_time,date) VALUES (?, ?, ?)',[employeeId,data.total_worked_time,formattedDate]);
      res.render("home.ejs",{message: 'Successful added to database',date: formattedDate, emp_id_list:emp_list})
    }
    else{
      res.render("home.ejs",{message: 'Already added cant add to database',date: formattedDate, emp_id_list:emp_list})
    }
    
  } catch (error) {
    console.error('Error querying the database:', error);
    res.status(500).send('Error querying the database ');
  }
  
});

app.get('/total', async (req, res) => {
  const sqlQuery = `
  SELECT *
  FROM total_work_done
  ORDER BY ID, STR_TO_DATE(date, '%d-%m-%Y') DESC;
  `;
  try {
    const [totalWork_list] = await db.query(sqlQuery);
    
    res.render("totalWork.ejs",{totalWork_list: totalWork_list,date: formattedDate,emp_id_list:emp_list});
  } catch (error) {
    console.error('Error querying employee IDs:', error);
  } 
});

app.post('/total/serach', async (req,res) => {
  const employeeId = parseInt(req.body.id);
  const sqlQuery = `
  SELECT *
  FROM total_work_done
  WHERE ID = ?
  ORDER BY STR_TO_DATE(date, '%d-%m-%Y') DESC;
  `;
  try {
    const [totalWork_list] = await db.query(sqlQuery,[employeeId]);
    res.render("totalWork.ejs",{totalWork_list: totalWork_list, date: formattedDate,emp_id_list:emp_list});
  } catch (error) {
    console.error('Error querying the database:', error);
    res.status(500).send('Error querying the database');
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});