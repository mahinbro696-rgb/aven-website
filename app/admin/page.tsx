"use client";

import {
  useEffect,
  useState
} from "react";

import {
  motion,
  AnimatePresence
} from "framer-motion";


import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";


import {db} from "@/lib/firebase";


import Sidebar from "@/components/admin/Sidebar";

import ProductSection from "@/components/admin/ProductSection";

import TelegramSettings from "@/components/admin/TelegramSettings";





interface Order{


id:string;

name:string;

phone:string;

district:string;

address:string;

product:string;

color:string;

quantity:number;

status:string;


}









export default function AdminPage(){



const [active,setActive]=useState(
"Dashboard"
);



const [orders,setOrders]=useState<Order[]>([]);



const [loading,setLoading]=useState(true);



const [search,setSearch]=useState("");









const fetchOrders=async()=>{


try{


setLoading(true);



const q=query(

collection(db,"orders"),

orderBy(
"createdAt",
"desc"
)

);



const snap=await getDocs(q);




const data=snap.docs.map(item=>(

{


id:item.id,

...item.data()


}

)) as Order[];




setOrders(data);



}

catch(error){


console.log(error);


}

finally{


setLoading(false);


}



};











useEffect(()=>{


fetchOrders();


},[]);












const updateStatus=async(

id:string,

status:string

)=>{


await updateDoc(

doc(
db,
"orders",
id
),

{

status

}

);




setOrders(prev=>

prev.map(order=>

order.id===id

?

{

...order,

status

}

:

order


)

);



};












const deleteOrder=async(

id:string

)=>{


const ok=confirm(
"Delete this order?"
);



if(!ok)return;




await deleteDoc(

doc(
db,
"orders",
id
)

);




setOrders(prev=>

prev.filter(

item=>

item.id!==id

)

);



};









const filteredOrders=orders.filter(order=>


order.name
?.toLowerCase()
.includes(
search.toLowerCase()
)


||


order.phone
?.includes(search)



||


order.product
?.toLowerCase()
.includes(
search.toLowerCase()
)


);










const pending=orders.filter(

x=>

x.status==="Pending"

).length;





const confirmed=orders.filter(

x=>

x.status==="Confirmed"

).length;





const delivered=orders.filter(

x=>

x.status==="Delivered"

).length;









return(



<div className="
flex
min-h-screen
bg-black
text-white
">



<Sidebar

active={active}

setActive={setActive}

/>







<main className="
flex-1
p-6
md:p-10
overflow-hidden
">






<AnimatePresence mode="wait">







{
active==="Dashboard" &&


<motion.section

key="dashboard"

initial={{

opacity:0,

y:30

}}

animate={{

opacity:1,

y:0

}}

>



<h1 className="
text-5xl
font-bold
text-yellow-400
">

AVEN ADMIN

</h1>




<p className="
text-gray-400
mt-2
">

Luxury Fashion Control Center

</p>








<div className="
grid
md:grid-cols-4
gap-5
mt-10
">



<Card

title="Total Orders"

value={orders.length}

/>




<Card

title="Pending"

value={pending}

/>




<Card

title="Confirmed"

value={confirmed}

/>




<Card

title="Delivered"

value={delivered}

/>




</div>







<div className="
mt-10
bg-zinc-900
border
border-yellow-500/20
rounded-3xl
p-8
">



<h2 className="
text-3xl
font-bold
text-yellow-400
">

Welcome AVEN

</h2>




<p className="
text-gray-400
mt-3
">

Manage products, orders and telegram settings.

</p>




</div>






</motion.section>


}{/* PRODUCTS */}

{
active==="Products" &&


<motion.section

key="products"

initial={{
opacity:0,
y:20
}}

animate={{
opacity:1,
y:0
}}

>


<ProductSection/>


</motion.section>


}









{/* ORDERS */}


{

active==="Orders" &&


<motion.section


key="orders"


initial={{
opacity:0,
y:20
}}


animate={{
opacity:1,
y:0
}}



>



<h1 className="
text-4xl
font-bold
text-yellow-400
mb-8
">

Orders Management

</h1>







<div className="
bg-zinc-900
border
border-yellow-500/20
rounded-3xl
p-6
">








<div className="
flex
gap-4
mb-6
">



<input

value={search}

onChange={(e)=>

setSearch(e.target.value)

}

placeholder="Search customer / phone / product"


className="
flex-1
bg-black
border
border-yellow-500/30
rounded-full
px-5
py-3
outline-none
"

/>






<button

onClick={fetchOrders}

className="
bg-yellow-500
text-black
px-6
rounded-full
font-bold
"

>

Refresh

</button>



</div>









{

loading ?


<p className="text-gray-400">

Loading orders...

</p>


:



<div className="overflow-x-auto">



<table className="w-full">



<thead>


<tr className="
border-b
border-gray-700
">



<th className="p-4 text-left">

Customer

</th>



<th className="p-4 text-left">

Product

</th>



<th className="p-4 text-left">

Color

</th>



<th className="p-4 text-left">

Status

</th>



<th className="p-4">

Action

</th>



</tr>



</thead>








<tbody>


{


filteredOrders.map(order=>(


<tr

key={order.id}

className="
border-b
border-gray-800
"



>






<td className="p-4">


<p className="font-bold">

{order.name}

</p>


<p className="text-gray-400">

{order.phone}

</p>



<p className="text-gray-500 text-sm">

{order.district}

</p>


</td>








<td className="p-4">


{order.product}


<p className="text-gray-400 text-sm">

Qty : {order.quantity}

</p>


</td>








<td className="p-4">

{order.color}

</td>








<td className="p-4">


<span className="
bg-yellow-500/20
text-yellow-400
px-4
py-2
rounded-full
">

{order.status}

</span>


</td>









<td className="
p-4
flex
gap-2
">





{

order.status==="Pending" &&


<button

onClick={()=>updateStatus(

order.id,

"Confirmed"

)}

className="
bg-blue-500
px-4
py-2
rounded-full
"

>

Confirm

</button>


}








{

order.status==="Confirmed" &&


<button

onClick={()=>updateStatus(

order.id,

"Delivered"

)}

className="
bg-green-600
px-4
py-2
rounded-full
"

>

Delivered

</button>


}








<button


onClick={()=>deleteOrder(order.id)}


className="
bg-red-600
px-4
py-2
rounded-full
"

>

Delete

</button>




</td>








</tr>


))


}



</tbody>



</table>



</div>


}



</div>




</motion.section>


}













{/* SETTINGS */}



{

active==="Settings" &&



<motion.section


key="settings"


initial={{
opacity:0,
y:20
}}



animate={{
opacity:1,
y:0
}}



>



<h1 className="
text-4xl
font-bold
text-yellow-400
">

Settings

</h1>






<div className="
mt-8
">


<TelegramSettings/>




</div>





</motion.section>



}









</AnimatePresence>







</main>






</div>


);



}













function Card({

title,

value

}:{

title:string;

value:number;

}){


return(



<motion.div


whileHover={{

scale:1.05

}}



className="
bg-zinc-900
border
border-yellow-500/20
rounded-3xl
p-6
"



>


<p className="
text-gray-400
">

{title}

</p>



<h2 className="
text-5xl
font-bold
text-yellow-400
mt-3
">

{value}

</h2>




</motion.div>



);



}