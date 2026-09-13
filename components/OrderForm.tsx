"use client";

import { useState } from "react";


export default function OrderForm() {


  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);


  const [form, setForm] = useState({

    name:"",
    phone:"",
    district:"",
    address:"",
    color:"Pink",
    quantity:1

  });





  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {


    setForm({

      ...form,

      [e.target.name]: e.target.value

    });


  };






  const submitOrder = async (
    e: React.FormEvent
  ) => {


    e.preventDefault();


    setLoading(true);



    const response = await fetch("/api/order", {


      method:"POST",


      headers:{

        "Content-Type":"application/json"

      },


      body:JSON.stringify({

        ...form,

        product:"Kushikatha Shawl"

      })


    });




    const data = await response.json();




    setLoading(false);




    if(data.success){


      alert("Order Confirmed! Thank you ❤️");


      setOpen(false);


    }
    else{


      alert("Something went wrong");


    }



  };






  return (

    <>


      <button

        onClick={()=>setOpen(true)}

        className="w-full bg-black text-white py-4 rounded-full"

      >

        Order Now

      </button>







      {
        open && (


          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-5">


            <div className="bg-white rounded-3xl p-8 w-full max-w-md">


              <h2 className="text-2xl font-bold mb-5">
                AVEN Order Form
              </h2>




              <form
                onSubmit={submitOrder}
                className="space-y-4"
              >



                <input

                  name="name"

                  onChange={handleChange}

                  placeholder="Your Name"

                  className="w-full border p-3 rounded-xl"

                  required

                />




                <input

                  name="phone"

                  onChange={handleChange}

                  placeholder="Phone Number"

                  className="w-full border p-3 rounded-xl"

                  required

                />





                <input

                  name="district"

                  onChange={handleChange}

                  placeholder="District"

                  className="w-full border p-3 rounded-xl"

                  required

                />





                <textarea

                  name="address"

                  onChange={handleChange}

                  placeholder="Full Address"

                  className="w-full border p-3 rounded-xl"

                  required

                />





                <select

                  name="color"

                  onChange={handleChange}

                  className="w-full border p-3 rounded-xl"

                >

                  <option>
                    Pink
                  </option>

                  <option>
                    Blue
                  </option>

                  <option>
                    Yellow
                  </option>


                </select>





                <input

                  name="quantity"

                  type="number"

                  min="1"

                  value={form.quantity}

                  onChange={handleChange}

                  className="w-full border p-3 rounded-xl"

                />







                <button

                  disabled={loading}

                  className="w-full bg-black text-white py-4 rounded-xl"

                >

                  {
                    loading
                    ?
                    "Sending..."
                    :
                    "Confirm Order"
                  }

                </button>




              </form>




            </div>


          </div>


        )

      }



    </>

  );


}