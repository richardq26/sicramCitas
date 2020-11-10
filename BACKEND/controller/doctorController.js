var passport = require("passport");
var config = require("../database/key");
require("../config/userpassport")(passport);
var jwt = require("jsonwebtoken");
var Doctor = require("../models/doctor");
var Especialidad = require("../models/especialidad");
const chalk = require("chalk");
var pup = require("../tools/scrapers");


//registro doctor
exports.SignupDoctor = async function (req, res) {
  try {
    if (!req.body.username || !req.body.password || !req.body.email) {
      res.json({
        success: false,
        msg: "Por favor, ponga nombre de usuario y contraseña",
      });
    } else {
      //encontrando al doctor por su email.
      await Doctor.findOne({ email: req.body.email }, async (erro, doctor) => {
        try {
          if (doctor) {
          
            res.status(401).json({ msg: "email ya esta siendo usado" });
          } else {
            //variable que contiene los datos del cmp encontrado
            const datosCMP = await pup.scrapeProduct(
              "https://200.48.13.39/cmp/php/detallexmedico.php?id=" +
                req.body.cmp
            );
            var especialidad = await Especialidad.findOne({
                especialidad: req.body.especialidad,
              });


            //si los nombres del doctor y cmp coinciden
            if (
              req.body.name.toLowerCase() == datosCMP.nombres.toLowerCase() &&
              req.body.lastname.toLowerCase() ==
                datosCMP.apellidos.toLowerCase()
            ) {
              //creamos el nuevo docotor y guaardamos sus datos
              var newDoctor = new Doctor({
                username: req.body.username,
                password: req.body.password,
                genero: req.body.genero,
                email: req.body.email,
                name: req.body.name,
                lastname: req.body.lastname,
                dni: req.body.dni,
                edad: req.body.edad,
                celular: req.body.celular,
                cmp: req.body.cmp,
                profesion: req.body.profesion,
              });

              //agregamos el atributo especialidad del doctor agregamos aparte por que especialidad es un Objeto encontrado en la base de datos
              newDoctor.especialidad = especialidad;
              // guardamos doctor registrado
              await newDoctor.save(function (err) {
                //error al guardar al doctor
                if (err) {
                  return res.json({
                    success: false,
                    msg: "Username ya existe",
                  });
                }
                //si todo estuvo bien respondemos Json
                res.json({
                  success: true,
                  msg: "Bienvenido Doctor, es un nuevo usario.",
                });
              });
              console.log(newDoctor);
              //guardamos especialidad
              especialidad.doctor.push(newDoctor);
              await especialidad.save();
            } else {
              res.json({
                msg:
                  "LLene los nombres y apellidos, completos y CORRECTOS del doctor",
              });
            }
          }
        } catch (e) {
        
          return res.status(400).json({
            msg: "CMP INCORRECTO",
          });
        }
      });
    }
  } catch (e) {
    console.log("Error"+e);
  }
};
//ingreso del doctor
exports.SigninDoctor = async function (req, res) {
  Doctor.findOne(
    {
      email: req.body.email,
    },
    function (err, doctor) {
      if (!doctor) {
        res.status(401).send({
          success: false,
          msg: "LA AUTENTICACION FALLO USUARIO NO EXISTE",
        });
      } else {
        doctor.comparePassword(req.body.password, function (err, isMatch) {
          if (isMatch && !err) {
            // si el usuario se encuentra y la contraseña  es correcta, crea un token
            var token = jwt.sign(doctor.toJSON(), config.database.secretU, {
              expiresIn: 604800, // 1 week
            });
            // retornamos la informacion incluyendo el token como json
            res.json({
              success: true,
              id: doctor._id,
              token: "Bearer " + token,
            });
          } else {
            res.status(401).send({
              success: false,
              msg: "LA AUTENTICACION FALLO PASSWORD INCORRECTO ",
            });
          }
        });
      }
    }
  );
};
//salida del doctor que se loggeo
exports.SignoutDoctor = function (req, res) {
  req.logout();
  res.json({ success: true, msg: "Sign out Doctor EXITOSA." });
};

exports.Actualizar_datos_doctor = async function (req, res) {
  try {
    var token = getToken(req.headers);
    if (token) {
      if (req.user.id == req.params.id) {
        await Doctor.findById(req.user.id, async (err, doctor) => {
          if (!doctor) {
           console.log("Doctor no encontrado");
          } else {
            //Buscamos la especialidad para borrar de esta al médico
            var especialidadEncontrada = await Especialidad.findById(
              doctor.especialidad
            );
            var nuevaEspecialidad = await Especialidad.findOne({
              especialidad: req.body.especialidad,
            });

            if (especialidadEncontrada != nuevaEspecialidad) {
              // Buscamos el médico dentro de la especialidad y hallamos el indice del array
              var indice = especialidadEncontrada.doctor.indexOf(doctor._id);
              // Con el índice que hallamos, ahora borramos ese doctor del array
              especialidadEncontrada.doctor.splice(indice, 1);
              // Guardamos los cambios y se actualiza con un doctor menos
              await especialidadEncontrada.save();
              doctor.especialidad = nuevaEspecialidad;
              //En la nueva especialidad pusheamos al doctor
              nuevaEspecialidad.doctor.push(doctor);
              await nuevaEspecialidad.save();
            }

            //Editamos datos del doctor
            doctor.email = req.body.email;
            doctor.celular = req.body.celular;
            doctor.edad = req.body.edad;

            await doctor.save((err, doctorUpdate) => {
              if (err) {
                console.log("Error al guardar");
                res.send("error al guardar al doctor actualizado :" + err);
              } else {
                res.json({
                  msg: "Doctor actualizado!",
                  doctor: doctorUpdate,
                });
              }
            });
          }
        }).populate("especialidad");
      } else {
        console.log("No es el usuario");
        res.send(
          "NO ES EL USUARIO   " +
            req.user.id +
            " comparando con " +
            req.params.id
        );
      }
    } else {
      
      return res.status(403).send({ success: false, msg: "Unauthorized." });
    }
  } catch (err) {
    console.log("error"+err);
  }
};
//obtener datos para el perfil del doctor
exports.Obtener_datos_doctor = async function (req, res) {
  try {
    var token = getToken(req.headers);
    if (token) {
      if (req.user.id == req.params.id) {
        var doctor = await Doctor.findById(req.params.id).populate(
          "especialidad"
        );
        console.log("Doctor"+doctor);
        res.send(doctor);
      } else {
        console.log("No es el usuario");
        res.send(
          "NO ES EL USUARIO    " +
            req.user.id +
            " username :  " +
            req.user.username +
            "  comparando con " +
            req.params.id
        );
      }
    } else {
      return res.status(403).send({ success: false, msg: "Unauthorized." });
    }
  } catch (error) {
    console.log("Error "+error);
    res.json({msg: "Error"+error});
  }
};


//HORARIOS del doctor
//agregar stack de horarios
exports.Agregar_horario_doctor = async function (req, res) {
  try {
    var token = getToken(req.headers);
    if (token) {
      if (req.user.id == req.params.id) {
        //encontramos doctor
        var doctor = await Doctor.findById(req.user.id);
        logger(chalk.blue("Doctor:") + chalk.green(doctor));
        //confirmando que este horario ya existe
        var horarioEncontrado = await Horario.findOne({
          fecha: req.body.fecha,
          hora_inicio: req.body.hora_inicio,
          hora_fin: req.body.hora_fin,
          doctor: doctor,
        });
        if (horarioEncontrado) {
          res.json({ msg: "YA EXISTE ESE HORARIO PARA EL DOCTOR" });
        } else {
          logger(chalk.red("puedes poner horario"));
          //nuevo horario agarramos por body los datos
          var newhorario = new Horario({
            fecha: req.body.fecha,
            hora_inicio: req.body.hora_inicio,
            hora_fin: req.body.hora_fin,
          });
          //agregamos el doctor del horario gracias al token
          newhorario.doctor = doctor;
          logger(chalk.blue("nuevo horario --- : ") + chalk.green(newhorario));
          //guardamos horario
          await newhorario.save((err, horario) => {
            if (err) {
              logger(chalk.red("Error al guardar horario"));
              res.send("error al guardar al horario :" + err);
            } else {
              logger(chalk.blue("Se guardó el horario"));
              res.status(200).json({ msg: "nuevo horario guardado" });
            }
          });
          //pusheamos el areglo de horarios del doctor
          doctor.horario.push(newhorario);
          //guardamos dooctor actualizado
          await doctor.save();
        }
      } else {
        logger(
          chalk.blue("NO es el usuario ") +
            chalk.green(req.user.id) +
            chalk.blue("comparado con ") +
            chalk.magenta(req.params.id)
        );
        res.send(
          "NO ES EL USUARIO   " +
            req.user.id +
            " comparando con " +
            req.params.id
        );
      }
    } else {
      return res.status(403).send({ success: false, msg: "Unauthorized." });
    }
  } catch (err) {
    loggerwin.info(err);
    logger(chalk.red("ERROR: ") + chalk.white(err));
    throw err;
  }
};
// Actualizar el horario del doctor
exports.Actualizar_horario_doctor = async function (req, res) {
  try {
    var token = getToken(req.headers);
    if (token) {
      if (req.user.id == req.params.id) {
        await Horario.findById(req.body.horario_id, async (err, horario) => {
          if (!horario) {
            logger(
              chalk.blue("Horario no encontrado error: ") + chalk.red(err)
            );
          } else {
            //horario encontrado es la coincidencia con el horario que recién están introduciendo, esto sirve para que no hayan 2 horarios con la misma hora así tengan diferentes ids
            var horarioEncontrado = await Horario.findOne({
              fecha: req.body.fecha,
              hora_inicio: req.body.hora_inicio,
              hora_fin: req.body.hora_fin,
            });
            logger(
              "doctor del horario: " +
                horario.doctor._id +
                " es igual a: " +
                req.user.id
            );

            if (!horarioEncontrado) {
              if (horario.doctor._id == req.user.id) {
                if (horario.ocupado == false) {
                  horario.fecha = req.body.fecha;
                  horario.hora_inicio = req.body.hora_inicio;
                  horario.hora_fin = req.body.hora_fin;

                  await horario.save((err, horarioUpdate) => {
                    if (err) {
                      logger(chalk.red("Error al guardar"));
                      res.json({
                        msg: "error al guardar al doctor actualizado :" + err,
                      });
                    } else {
                      res.json({ msg: "Horario actualizado! " });
                    }
                  });
                } else {
                  res.json({
                    msg:
                      "El horario esta siendo usado en una cita, No se puede Modificar",
                  });
                }
              } else {
                res.json({ msg: "El Horario no pertenece al doctor" });
              }
            } else {
              res.json({ msg: "Este horario ya existe, elige otro" });
            }
          }
        }).populate({
          path: "doctor",
          populate: { path: "organizacion", select: "nameOrg" },
          select: "name & lastname",
        });
      } else {
        logger(
          chalk.blue("NO es el usuario ") +
            chalk.green(req.user.id) +
            chalk.blue("comparado con ") +
            chalk.magenta(req.params.id)
        );
        res.send(
          "NO ES EL USUARIO   " +
            req.user.id +
            " comparando con " +
            req.params.id
        );
      }
    } else {
      loggerwin.info("usuario no autorizado");
      return res.status(403).send({ success: false, msg: "Unauthorized." });
    }
  } catch (err) {
    loggerwin.info(err);
    logger(chalk.red("ERROR:") + chalk.white(err));
  }
};

getToken = function (headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization.split(" ");
    if (parted.length === 2) {
      return parted[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};